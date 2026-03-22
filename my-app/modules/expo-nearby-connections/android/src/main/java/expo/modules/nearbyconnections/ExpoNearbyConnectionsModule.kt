package expo.modules.nearbyconnections

import android.os.Bundle
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoNearbyConnectionsModule : Module() {
  companion object {
    private const val HUB_METADATA_SEPARATOR = "@@hub@@"
  }

  private data class EndpointDescriptor(
    val endpointId: String,
    val endpointName: String,
    val hubMetadata: String?
  )

  private data class ParsedEndpointName(
    val endpointName: String,
    val hubMetadata: String?
  )

  private val discoveredEndpoints = mutableMapOf<String, EndpointDescriptor>()
  private val pendingEndpoints = mutableMapOf<String, EndpointDescriptor>()
  private val connectedEndpoints = mutableMapOf<String, EndpointDescriptor>()

  private val connectionsClient: ConnectionsClient
    get() = Nearby.getConnectionsClient(requireContext())

  override fun definition() = ModuleDefinition {
    Name("ExpoNearbyConnections")

    Events(
      "onEndpointFound",
      "onEndpointLost",
      "onConnectionInitiated",
      "onConnectionAccepted",
      "onConnectionRejected",
      "onConnectionDisconnected",
      "onPayloadReceived",
      "onTransportLog"
    )

    AsyncFunction("startAdvertising") { serviceId: String, nodeName: String, hubMetadata: String?, promise: Promise ->
      val endpointName = composeAdvertisedEndpointName(nodeName, hubMetadata)

      connectionsClient.stopAdvertising()
      connectionsClient
        .startAdvertising(
          endpointName,
          serviceId,
          connectionLifecycleCallback,
          AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        )
        .addOnSuccessListener {
          log("Advertising started as $nodeName on service $serviceId")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to start advertising: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_START_ADVERTISING",
            exception.localizedMessage ?: "Unable to start advertising",
            exception
          )
        }
    }

    AsyncFunction("stopAdvertising") {
      connectionsClient.stopAdvertising()
      log("Advertising stopped")
    }

    AsyncFunction("startDiscovery") { serviceId: String, promise: Promise ->
      connectionsClient.stopDiscovery()
      connectionsClient
        .startDiscovery(
          serviceId,
          endpointDiscoveryCallback,
          DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        )
        .addOnSuccessListener {
          log("Discovery started for service $serviceId")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to start discovery: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_START_DISCOVERY",
            exception.localizedMessage ?: "Unable to start discovery",
            exception
          )
        }
    }

    AsyncFunction("stopDiscovery") {
      connectionsClient.stopDiscovery()
      discoveredEndpoints.clear()
      log("Discovery stopped")
    }

    AsyncFunction("requestConnection") { endpointId: String, localName: String, promise: Promise ->
      connectionsClient
        .requestConnection(localName, endpointId, connectionLifecycleCallback)
        .addOnSuccessListener {
          log("Connection request sent to $endpointId")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to request connection for $endpointId: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_REQUEST_CONNECTION",
            exception.localizedMessage ?: "Unable to request connection",
            exception
          )
        }
    }

    AsyncFunction("acceptConnection") { endpointId: String, promise: Promise ->
      connectionsClient
        .acceptConnection(endpointId, payloadCallback)
        .addOnSuccessListener {
          log("Accepted connection for $endpointId")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to accept connection for $endpointId: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_ACCEPT_CONNECTION",
            exception.localizedMessage ?: "Unable to accept connection",
            exception
          )
        }
    }

    AsyncFunction("rejectConnection") { endpointId: String, promise: Promise ->
      connectionsClient
        .rejectConnection(endpointId)
        .addOnSuccessListener {
          pendingEndpoints.remove(endpointId)
          log("Rejected connection for $endpointId")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to reject connection for $endpointId: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_REJECT_CONNECTION",
            exception.localizedMessage ?: "Unable to reject connection",
            exception
          )
        }
    }

    AsyncFunction("disconnect") { endpointId: String ->
      connectionsClient.disconnectFromEndpoint(endpointId)
      connectedEndpoints.remove(endpointId)
      pendingEndpoints.remove(endpointId)
      log("Disconnected from $endpointId")
    }

    AsyncFunction("disconnectAll") {
      connectionsClient.stopAllEndpoints()
      connectedEndpoints.clear()
      pendingEndpoints.clear()
      log("Disconnected from all endpoints")
    }

    AsyncFunction("sendPayload") { endpointId: String, payload: String, promise: Promise ->
      connectionsClient
        .sendPayload(endpointId, Payload.fromBytes(payload.toByteArray(Charsets.UTF_8)))
        .addOnSuccessListener {
          log("Sent payload to $endpointId")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to send payload to $endpointId: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_SEND_PAYLOAD",
            exception.localizedMessage ?: "Unable to send payload",
            exception
          )
        }
    }

    AsyncFunction("sendPayloadToMany") { endpointIds: List<String>, payload: String, promise: Promise ->
      connectionsClient
        .sendPayload(endpointIds, Payload.fromBytes(payload.toByteArray(Charsets.UTF_8)))
        .addOnSuccessListener {
          log("Sent payload to ${endpointIds.joinToString(", ")}")
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          log("Failed to send payload to many endpoints: ${exception.localizedMessage}")
          promise.reject(
            "ERR_NEARBY_SEND_PAYLOAD_MANY",
            exception.localizedMessage ?: "Unable to send payload to many endpoints",
            exception
          )
        }
    }

    AsyncFunction("getConnectedPeers") {
      connectedEndpoints.values.map { endpoint ->
        mapOf(
          "endpointId" to endpoint.endpointId,
          "endpointName" to endpoint.endpointName,
          "hubMetadata" to endpoint.hubMetadata
        )
      }
    }
  }

  private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      val parsed = parseAdvertisedEndpointName(info.endpointName)
      val descriptor = EndpointDescriptor(endpointId, parsed.endpointName, parsed.hubMetadata)
      discoveredEndpoints[endpointId] = descriptor

      sendEvent(
        "onEndpointFound",
        Bundle().apply {
          putString("endpointId", endpointId)
          putString("endpointName", descriptor.endpointName)
          putString("serviceId", info.serviceId)
          putString("hubMetadata", descriptor.hubMetadata)
        }
      )

      log("Endpoint found: $endpointId (${descriptor.endpointName})")
    }

    override fun onEndpointLost(endpointId: String) {
      discoveredEndpoints.remove(endpointId)

      sendEvent(
        "onEndpointLost",
        Bundle().apply {
          putString("endpointId", endpointId)
        }
      )

      log("Endpoint lost: $endpointId")
    }
  }

  private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      val parsed = parseAdvertisedEndpointName(info.endpointName)
      val descriptor = EndpointDescriptor(endpointId, parsed.endpointName, parsed.hubMetadata)
      pendingEndpoints[endpointId] = descriptor

      sendEvent(
        "onConnectionInitiated",
        Bundle().apply {
          putString("endpointId", endpointId)
          putString("endpointName", descriptor.endpointName)
          putString("hubMetadata", descriptor.hubMetadata)
          putString("authenticationToken", info.authenticationToken)
        }
      )

      log("Connection initiated by $endpointId (${descriptor.endpointName})")
    }

    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      val descriptor = pendingEndpoints[endpointId] ?: discoveredEndpoints[endpointId]
      val statusCode = resolution.status.statusCode
      val statusMessage = resolution.status.statusMessage ?: statusCode.toString()

      if (statusCode == ConnectionsStatusCodes.STATUS_OK) {
        descriptor?.let {
          connectedEndpoints[endpointId] = it
        }
        pendingEndpoints.remove(endpointId)
        discoveredEndpoints.remove(endpointId)

        sendEvent(
          "onConnectionAccepted",
          Bundle().apply {
            putString("endpointId", endpointId)
            putString("endpointName", descriptor?.endpointName ?: endpointId)
            putString("hubMetadata", descriptor?.hubMetadata)
          }
        )

        log("Connection accepted with $endpointId (${descriptor?.endpointName ?: "unknown"})")
        return
      }

      pendingEndpoints.remove(endpointId)

      sendEvent(
        "onConnectionRejected",
        Bundle().apply {
          putString("endpointId", endpointId)
          putString("endpointName", descriptor?.endpointName ?: endpointId)
          putString("hubMetadata", descriptor?.hubMetadata)
          putInt("statusCode", statusCode)
          putString("statusMessage", statusMessage)
        }
      )

      log("Connection rejected for $endpointId: $statusMessage")
    }

    override fun onDisconnected(endpointId: String) {
      val descriptor =
        connectedEndpoints.remove(endpointId)
          ?: pendingEndpoints.remove(endpointId)
          ?: discoveredEndpoints[endpointId]

      sendEvent(
        "onConnectionDisconnected",
        Bundle().apply {
          putString("endpointId", endpointId)
          putString("endpointName", descriptor?.endpointName ?: endpointId)
          putString("hubMetadata", descriptor?.hubMetadata)
        }
      )

      log("Connection disconnected from $endpointId (${descriptor?.endpointName ?: "unknown"})")
    }
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      if (payload.type != Payload.Type.BYTES) {
        log("Ignoring non-bytes payload from $endpointId")
        return
      }

      val text = String(payload.asBytes() ?: ByteArray(0), Charsets.UTF_8)

      sendEvent(
        "onPayloadReceived",
        Bundle().apply {
          putString("endpointId", endpointId)
          putString("payload", text)
        }
      )

      log("Payload received from $endpointId")
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
      if (update.status == PayloadTransferUpdate.Status.FAILURE) {
        log("Payload transfer failed for $endpointId")
      }

      if (update.status == PayloadTransferUpdate.Status.CANCELED) {
        log("Payload transfer canceled for $endpointId")
      }
    }
  }

  private fun requireContext() = requireNotNull(appContext.reactContext) {
    "React context is not available"
  }

  private fun composeAdvertisedEndpointName(endpointName: String, hubMetadata: String?): String {
    val safeEndpointName = endpointName.replace(HUB_METADATA_SEPARATOR, " ")
    return if (hubMetadata.isNullOrBlank()) {
      safeEndpointName
    } else {
      "$safeEndpointName$HUB_METADATA_SEPARATOR$hubMetadata"
    }
  }

  private fun parseAdvertisedEndpointName(rawValue: String?): ParsedEndpointName {
    if (rawValue.isNullOrBlank()) {
      return ParsedEndpointName("Unknown node", null)
    }

    val separatorIndex = rawValue.indexOf(HUB_METADATA_SEPARATOR)
    if (separatorIndex == -1) {
      return ParsedEndpointName(rawValue, null)
    }

    val endpointName = rawValue.substring(0, separatorIndex)
    val hubMetadata = rawValue.substring(separatorIndex + HUB_METADATA_SEPARATOR.length)
    return ParsedEndpointName(endpointName, hubMetadata.ifBlank { null })
  }

  private fun log(message: String) {
    sendEvent(
      "onTransportLog",
      Bundle().apply {
        putLong("timestamp", System.currentTimeMillis())
        putString("message", message)
      }
    )
  }
}
