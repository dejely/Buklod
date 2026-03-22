import { useEffect, useRef } from 'react';

import {
  addNearbyListener,
  isNearbyConnectionsAvailable,
  type NearbyConnectionInitiatedEvent,
  type NearbyConnectionRejectedEvent,
  type NearbyConnectionStateEvent,
  type NearbyEndpointFoundEvent,
  type NearbyEndpointLostEvent,
  type NearbyPayloadReceivedEvent,
  type NearbyTransportLogEvent,
} from './nearbyTransport';

type NearbyEventHandlers = {
  onEndpointFound?: (event: NearbyEndpointFoundEvent) => void;
  onEndpointLost?: (event: NearbyEndpointLostEvent) => void;
  onConnectionInitiated?: (event: NearbyConnectionInitiatedEvent) => void;
  onConnectionAccepted?: (event: NearbyConnectionStateEvent) => void;
  onConnectionRejected?: (event: NearbyConnectionRejectedEvent) => void;
  onConnectionDisconnected?: (event: NearbyConnectionStateEvent) => void;
  onPayloadReceived?: (event: NearbyPayloadReceivedEvent) => void;
  onTransportLog?: (event: NearbyTransportLogEvent) => void;
};

export function useNearbyEvents(
  handlers: NearbyEventHandlers,
  enabled: boolean
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !isNearbyConnectionsAvailable()) {
      return;
    }

    const subscriptions = [
      addNearbyListener('onEndpointFound', (event) => {
        handlersRef.current.onEndpointFound?.(event);
      }),
      addNearbyListener('onEndpointLost', (event) => {
        handlersRef.current.onEndpointLost?.(event);
      }),
      addNearbyListener('onConnectionInitiated', (event) => {
        handlersRef.current.onConnectionInitiated?.(event);
      }),
      addNearbyListener('onConnectionAccepted', (event) => {
        handlersRef.current.onConnectionAccepted?.(event);
      }),
      addNearbyListener('onConnectionRejected', (event) => {
        handlersRef.current.onConnectionRejected?.(event);
      }),
      addNearbyListener('onConnectionDisconnected', (event) => {
        handlersRef.current.onConnectionDisconnected?.(event);
      }),
      addNearbyListener('onPayloadReceived', (event) => {
        handlersRef.current.onPayloadReceived?.(event);
      }),
      addNearbyListener('onTransportLog', (event) => {
        handlersRef.current.onTransportLog?.(event);
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });
    };
  }, [enabled]);
}
