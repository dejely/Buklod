import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useMeshChat } from '@/src/mesh/useMeshChat';

function ActionButton({
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'success';
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        tone === 'danger' && styles.actionButtonDanger,
        tone === 'success' && styles.actionButtonSuccess,
        disabled && styles.actionButtonDisabled,
      ]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function MeshChatScreen() {
  const {
    advertising,
    available,
    connectToEndpoint,
    connectedPeers,
    disconnectPeer,
    discoveredEndpoints,
    draft,
    logs,
    messages,
    nodeId,
    permissionState,
    sendMessage,
    serviceId,
    setDraft,
    startAdvertising,
    startDiscovery,
    stopAll,
  } = useMeshChat();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Offline Mesh Demo</Text>
          <Text style={styles.title}>Expo + Nearby Connections</Text>
          <Text style={styles.meta}>Local node: {nodeId}</Text>
          <Text style={styles.meta}>Service ID: {serviceId}</Text>
          <Text style={styles.meta}>
            Native module: {available ? 'available' : 'Android development build required'}
          </Text>
          <Text style={styles.meta}>Permissions: {permissionState}</Text>
          <Text style={styles.meta}>Advertising: {advertising ? 'on' : 'off'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controls</Text>
          <View style={styles.buttonRow}>
            <ActionButton
              label="Start Advertising"
              onPress={() => {
                void startAdvertising();
              }}
              disabled={!available}
              tone="success"
            />
            <ActionButton
              label="Start Discovery"
              onPress={() => {
                void startDiscovery();
              }}
              disabled={!available}
            />
            <ActionButton
              label="Stop"
              onPress={() => {
                void stopAll();
              }}
              disabled={!available}
              tone="danger"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compose</Text>
          <TextInput
            placeholder="Type a text message"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <ActionButton
            label="Send Message"
            onPress={() => {
              void sendMessage();
            }}
            disabled={!available || !draft.trim() || connectedPeers.length === 0}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovered Endpoints</Text>
          {discoveredEndpoints.length === 0 ? (
            <Text style={styles.emptyState}>No nearby endpoints discovered yet.</Text>
          ) : (
            discoveredEndpoints.map((endpoint) => (
              <View key={endpoint.endpointId} style={styles.rowCard}>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowTitle}>{endpoint.endpointName}</Text>
                  <Text style={styles.rowMeta}>endpointId: {endpoint.endpointId}</Text>
                </View>
                <ActionButton
                  label="Connect"
                  onPress={() => {
                    void connectToEndpoint(endpoint.endpointId);
                  }}
                  disabled={!available}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Peers</Text>
          {connectedPeers.length === 0 ? (
            <Text style={styles.emptyState}>No active peer connections.</Text>
          ) : (
            connectedPeers.map((peer) => (
              <View key={peer.endpointId} style={styles.rowCard}>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowTitle}>{peer.endpointName}</Text>
                  <Text style={styles.rowMeta}>endpointId: {peer.endpointId}</Text>
                </View>
                <ActionButton
                  label="Disconnect"
                  onPress={() => {
                    void disconnectPeer(peer.endpointId);
                  }}
                  tone="danger"
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message Log</Text>
          {messages.length === 0 ? (
            <Text style={styles.emptyState}>No mesh messages yet.</Text>
          ) : (
            messages.map((message) => (
              <View key={message.id} style={styles.messageCard}>
                <Text style={styles.messageDirection}>
                  {message.direction === 'sent' ? 'Sent' : 'Received'}
                </Text>
                <Text style={styles.messageText}>{message.text}</Text>
                <Text style={styles.messageMeta}>origin: {message.originNodeId}</Text>
                <Text style={styles.messageMeta}>
                  current sender: {message.currentSenderNodeId}
                </Text>
                <Text style={styles.messageMeta}>
                  ttl: {message.ttl} | hopCount: {message.hopCount}
                </Text>
                <Text style={styles.messageMeta}>
                  via endpoint: {message.receivedFromEndpointId ?? 'local device'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Logs</Text>
          {logs.length === 0 ? (
            <Text style={styles.emptyState}>No logs yet.</Text>
          ) : (
            logs.map((log) => (
              <Text key={log.id} style={styles.logLine}>
                [{new Date(log.createdAt).toLocaleTimeString()}] {log.message}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08111f',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    backgroundColor: '#102038',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f3558',
    padding: 16,
    gap: 6,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  meta: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  section: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonSuccess: {
    backgroundColor: '#0f766e',
  },
  actionButtonDanger: {
    backgroundColor: '#b91c1c',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    color: '#f8fafc',
    padding: 12,
    textAlignVertical: 'top',
  },
  emptyState: {
    color: '#94a3b8',
    fontSize: 14,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
    padding: 12,
  },
  rowTextBlock: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  messageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
    padding: 12,
    gap: 4,
  },
  messageDirection: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  messageText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  messageMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  logLine: {
    color: '#cbd5e1',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
