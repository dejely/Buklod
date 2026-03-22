import { SafeAreaView } from 'react-native-safe-area-context';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useHubMesh } from '@/src/hub/useHubMesh';

type ActionButtonTone = 'primary' | 'secondary' | 'danger' | 'success';

function ActionButton({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: ActionButtonTone;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        tone === 'secondary' && styles.actionButtonSecondary,
        tone === 'danger' && styles.actionButtonDanger,
        tone === 'success' && styles.actionButtonSuccess,
        disabled && styles.actionButtonDisabled,
      ]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({
  label,
  value,
  emphasis = 'default',
}: {
  label: string;
  value: string;
  emphasis?: 'default' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.statusPill,
        emphasis === 'success' && styles.statusPillSuccess,
        emphasis === 'warning' && styles.statusPillWarning,
      ]}>
      <Text style={styles.statusPillLabel}>{label}</Text>
      <Text style={styles.statusPillValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function HubMeshScreen() {
  const {
    advertising,
    available,
    connectedPeers,
    createHub,
    currentHub,
    discoverHubs,
    discoveredHubs,
    disconnectPeer,
    discovering,
    hubNameDraft,
    joinHub,
    logs,
    meshActive,
    messageDraft,
    messages,
    nodeId,
    nodeName,
    permissionState,
    sendMessage,
    serviceId,
    setHubNameDraft,
    setMessageDraft,
    startMesh,
    stopMesh,
  } = useHubMesh();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Offline Hub Mesh</Text>
            <Text style={styles.heroTitle}>Nearby rooms that relay themselves outward.</Text>
            <Text style={styles.heroCopy}>
              Android-only Expo development build using Google Nearby Connections as the direct
              transport and TypeScript flooding for multi-hop hub messages.
            </Text>

            <View style={styles.statusGrid}>
              <StatusPill label="Node" value={nodeName} emphasis="success" />
              <StatusPill label="Mesh" value={meshActive ? 'running' : 'idle'} />
              <StatusPill
                label="Advertising"
                value={advertising ? 'on' : 'off'}
                emphasis={advertising ? 'success' : 'warning'}
              />
              <StatusPill
                label="Discovery"
                value={discovering ? 'on' : 'off'}
                emphasis={discovering ? 'success' : 'warning'}
              />
              <StatusPill label="Peers" value={String(connectedPeers.length)} />
              <StatusPill label="Permissions" value={permissionState} />
            </View>

            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>Local node ID: {nodeId}</Text>
              <Text style={styles.heroMetaText}>Service: {serviceId}</Text>
              <Text style={styles.heroMetaText}>
                Runtime: {available ? 'native module ready' : 'Android dev build required'}
              </Text>
            </View>

            <View style={styles.actionGrid}>
              <ActionButton
                label="Start Mesh"
                onPress={() => {
                  void startMesh();
                }}
                disabled={!available}
                tone="success"
              />
              <ActionButton
                label="Stop Mesh"
                onPress={() => {
                  void stopMesh();
                }}
                disabled={!available}
                tone="danger"
              />
              <ActionButton
                label="Discover Hubs"
                onPress={() => {
                  void discoverHubs();
                }}
                disabled={!available}
                tone="secondary"
              />
              <ActionButton
                label="Create Hub"
                onPress={() => {
                  void createHub();
                }}
                disabled={!available || !hubNameDraft.trim()}
              />
            </View>
          </View>

          <SectionCard
            title="Hub Control"
            subtitle="Create a local room or join one being advertised nearby.">
            <Text style={styles.inputLabel}>Hub Name</Text>
            <TextInput
              value={hubNameDraft}
              onChangeText={setHubNameDraft}
              placeholder="Team Alpha"
              placeholderTextColor="#6a7085"
              style={styles.textInput}
            />

            <View style={styles.currentHubBanner}>
              <View style={styles.currentHubBadge}>
                <Text style={styles.currentHubBadgeText}>
                  {currentHub ? currentHub.status.toUpperCase() : 'NO HUB'}
                </Text>
              </View>
              {currentHub ? (
                <View style={styles.currentHubTextWrap}>
                  <Text style={styles.currentHubTitle}>{currentHub.hubName}</Text>
                  <Text style={styles.currentHubMeta}>hubId: {currentHub.hubId}</Text>
                  <Text style={styles.currentHubMeta}>
                    creator: {currentHub.creatorNodeId} • members known:{' '}
                    {currentHub.membersKnown?.length ?? 1}
                  </Text>
                </View>
              ) : (
                <Text style={styles.emptyState}>
                  No active hub yet. Create one or discover a nearby advertised room.
                </Text>
              )}
            </View>
          </SectionCard>

          <SectionCard
            title="Discovered Hubs"
            subtitle="These are logical rooms announced by nearby devices.">
            {discoveredHubs.length === 0 ? (
              <Text style={styles.emptyState}>
                No joinable hubs discovered yet. Start mesh on another phone and create a hub.
              </Text>
            ) : (
              discoveredHubs.map((hub) => {
                const isCurrentHub = currentHub?.hubId === hub.hubId;

                return (
                  <View key={`${hub.hubId}-${hub.viaEndpointId}`} style={styles.listCard}>
                    <View style={styles.listTextWrap}>
                      <Text style={styles.listTitle}>{hub.hubName}</Text>
                      <Text style={styles.listMeta}>hubId: {hub.hubId}</Text>
                      <Text style={styles.listMeta}>
                        via {hub.endpointName} • reachable peers: {hub.reachableEndpointIds.length}
                      </Text>
                    </View>
                    <ActionButton
                      label={isCurrentHub ? 'Joined' : 'Join Hub'}
                      onPress={() => {
                        void joinHub(hub);
                      }}
                      disabled={isCurrentHub}
                      tone={isCurrentHub ? 'secondary' : 'primary'}
                    />
                  </View>
                );
              })
            )}
          </SectionCard>

          <SectionCard
            title="Connected Peers"
            subtitle="These are direct Nearby connections carrying relayed hub traffic.">
            {connectedPeers.length === 0 ? (
              <Text style={styles.emptyState}>No active direct peer links yet.</Text>
            ) : (
              connectedPeers.map((peer) => (
                <View key={peer.endpointId} style={styles.listCard}>
                  <View style={styles.listTextWrap}>
                    <Text style={styles.listTitle}>{peer.endpointName}</Text>
                    <Text style={styles.listMeta}>endpointId: {peer.endpointId}</Text>
                    {peer.hubMetadata ? (
                      <Text style={styles.listMeta}>advertising active hub metadata</Text>
                    ) : (
                      <Text style={styles.listMeta}>peer is mesh-only right now</Text>
                    )}
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
          </SectionCard>

          <SectionCard
            title="Hub Feed"
            subtitle="Messages stay inside the current hub and relay hop-by-hop.">
            {currentHub ? (
              <View style={styles.feedBanner}>
                <Text style={styles.feedBannerText}>
                  Current hub: {currentHub.hubName} ({currentHub.hubId})
                </Text>
              </View>
            ) : null}

            {messages.length === 0 ? (
              <Text style={styles.emptyState}>
                No hub messages yet. Send one after at least one other device joins.
              </Text>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageCard,
                    message.direction === 'sent' && styles.messageCardSent,
                  ]}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageSender}>{message.senderName}</Text>
                    <Text style={styles.messageDirection}>{message.direction}</Text>
                  </View>
                  <Text style={styles.messageText}>{message.text}</Text>
                  <Text style={styles.messageMeta}>
                    ttl {message.ttl} • hop {message.hopCount} • from{' '}
                    {message.receivedFromEndpointId ?? 'local node'}
                  </Text>
                </View>
              ))
            )}

            <View style={styles.composer}>
              <TextInput
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder={
                  currentHub ? `Message ${currentHub.hubName}` : 'Join a hub to start chatting'
                }
                placeholderTextColor="#6a7085"
                style={[styles.textInput, styles.composerInput]}
                multiline
              />
              <ActionButton
                label="Send"
                onPress={() => {
                  void sendMessage();
                }}
                disabled={!currentHub || !messageDraft.trim()}
              />
            </View>
          </SectionCard>

          <SectionCard
            title="Debug Stream"
            subtitle="Use this panel to prove hub creation, joins, sync, and multi-hop forwarding.">
            {logs.length === 0 ? (
              <Text style={styles.emptyState}>No logs yet.</Text>
            ) : (
              logs.map((log) => (
                <Text
                  key={log.id}
                  style={[
                    styles.logLine,
                    log.tone === 'success' && styles.logLineSuccess,
                    log.tone === 'warning' && styles.logLineWarning,
                  ]}>
                  [{new Date(log.createdAt).toLocaleTimeString()}] {log.message}
                </Text>
              ))
            )}
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#061018',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 18,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(18, 153, 163, 0.18)',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: 'rgba(232, 170, 62, 0.08)',
  },
  heroCard: {
    backgroundColor: '#0b1722',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1d3042',
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  heroEyebrow: {
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#f6fbff',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroCopy: {
    color: '#a9b8c9',
    fontSize: 14,
    lineHeight: 20,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusPill: {
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: '#101f2d',
    borderWidth: 1,
    borderColor: '#1d3042',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  statusPillSuccess: {
    borderColor: '#21645b',
    backgroundColor: '#102924',
  },
  statusPillWarning: {
    borderColor: '#6a4b1d',
    backgroundColor: '#2a1e0e',
  },
  statusPillLabel: {
    color: '#7d8da2',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusPillValue: {
    color: '#ecf5ff',
    fontSize: 14,
    fontWeight: '700',
  },
  heroMeta: {
    gap: 4,
  },
  heroMetaText: {
    color: '#8294ab',
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#15879b',
    borderWidth: 1,
    borderColor: '#34b5c4',
  },
  actionButtonSecondary: {
    backgroundColor: '#1d2430',
    borderColor: '#394658',
  },
  actionButtonDanger: {
    backgroundColor: '#47181e',
    borderColor: '#8b2e3a',
  },
  actionButtonSuccess: {
    backgroundColor: '#17463d',
    borderColor: '#2a7d6d',
  },
  actionButtonDisabled: {
    opacity: 0.42,
  },
  actionButtonText: {
    color: '#f6fbff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionCard: {
    backgroundColor: 'rgba(11, 23, 34, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1b2d3f',
    padding: 18,
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: '#f6fbff',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#8fa1b7',
    fontSize: 13,
    lineHeight: 18,
  },
  inputLabel: {
    color: '#8fa1b7',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#23384d',
    backgroundColor: '#08111b',
    color: '#f6fbff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  currentHubBanner: {
    borderRadius: 22,
    backgroundColor: '#09121b',
    borderWidth: 1,
    borderColor: '#23384d',
    padding: 16,
    gap: 10,
  },
  currentHubBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#163949',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentHubBadgeText: {
    color: '#86e8ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  currentHubTextWrap: {
    gap: 4,
  },
  currentHubTitle: {
    color: '#f6fbff',
    fontSize: 22,
    fontWeight: '800',
  },
  currentHubMeta: {
    color: '#93a8bd',
    fontSize: 13,
  },
  emptyState: {
    color: '#7f91a7',
    fontSize: 14,
    lineHeight: 20,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#23384d',
    backgroundColor: '#09121b',
    padding: 14,
  },
  listTextWrap: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    color: '#f6fbff',
    fontSize: 16,
    fontWeight: '800',
  },
  listMeta: {
    color: '#8fa1b7',
    fontSize: 12,
  },
  feedBanner: {
    borderRadius: 16,
    backgroundColor: '#11383c',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedBannerText: {
    color: '#adfff1',
    fontSize: 13,
    fontWeight: '700',
  },
  messageCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#23384d',
    backgroundColor: '#09121b',
    padding: 14,
    gap: 8,
  },
  messageCardSent: {
    borderColor: '#2c6c5d',
    backgroundColor: '#0d1d1a',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  messageSender: {
    color: '#f6fbff',
    fontSize: 14,
    fontWeight: '800',
  },
  messageDirection: {
    color: '#7fe5d2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  messageText: {
    color: '#e9f4ff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageMeta: {
    color: '#8aa1b5',
    fontSize: 12,
  },
  composer: {
    gap: 10,
  },
  composerInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  logLine: {
    color: '#c5d2df',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  logLineSuccess: {
    color: '#91f7d8',
  },
  logLineWarning: {
    color: '#f9be73',
  },
});
