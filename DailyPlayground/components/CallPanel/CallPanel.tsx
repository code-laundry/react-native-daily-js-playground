import React, { useEffect, useReducer, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { logDailyEvent } from '../../utils';
import { DailyEvent } from '@daily-co/react-native-daily-js';
import {
  callReducer,
  initialCallState,
  PARTICIPANTS_CHANGE,
  CAM_OR_MIC_ERROR,
  FATAL_ERROR,
  isScreenShare,
  isLocal,
  containsScreenShare,
  getMessage,
} from './callState';
import Tile from '../Tile/Tile';
import CallMessage from '../CallMessage/CallMessage';
import { useCallObject } from '../../useCallObject';

type Props = {
  roomUrl: string;
};

const CallPanel = (props: Props) => {
  const callObject = useCallObject();
  const [callState, dispatch] = useReducer(callReducer, initialCallState);

  /**
   * Start listening for participant changes, when the callObject is set.
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    const events: DailyEvent[] = [
      'participant-joined',
      'participant-updated',
      'participant-left',
    ];

    const handleNewParticipantsState = (event?: any) => {
      event && logDailyEvent(event);
      dispatch({
        type: PARTICIPANTS_CHANGE,
        participants: callObject.participants(),
      });
    };

    // Use initial state
    handleNewParticipantsState();

    // Listen for changes in state
    for (const event of events) {
      callObject.on(event, handleNewParticipantsState);
    }

    // Stop listening for changes in state
    return function cleanup() {
      for (const event of events) {
        callObject.off(event, handleNewParticipantsState);
      }
    };
  }, [callObject]);

  /**
   * Start listening for call errors, when the callObject is set.
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    function handleCameraErrorEvent(event?: any) {
      logDailyEvent(event);
      dispatch({
        type: CAM_OR_MIC_ERROR,
        message:
          (event && event.errorMsg && event.errorMsg.errorMsg) || 'Unknown',
      });
    }

    // We're making an assumption here: there is no camera error when callObject
    // is first assigned.

    callObject.on('camera-error', handleCameraErrorEvent);

    return function cleanup() {
      callObject.off('camera-error', handleCameraErrorEvent);
    };
  }, [callObject]);

  /**
   * Start listening for fatal errors, when the callObject is set.
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    function handleErrorEvent(event?: any) {
      logDailyEvent(event);
      dispatch({
        type: FATAL_ERROR,
        message: (event && event.errorMsg) || 'Unknown',
      });
    }

    // We're making an assumption here: there is no error when callObject is
    // first assigned.

    callObject.on('error', handleErrorEvent);

    return function cleanup() {
      callObject.off('error', handleErrorEvent);
    };
  }, [callObject]);

  /**
   * Toggle between front and rear cameras.
   */
  const flipCamera = useCallback(() => {
    callObject && callObject.cycleCamera();
  }, [callObject]);

  /**
   * Send an app message to the remote participant whose tile was clicked on.
   */
  const sendHello = useCallback(
    (participantId: string) => {
      callObject &&
        callObject.sendAppMessage({ hello: 'world' }, participantId);
    },
    [callObject]
  );

  const [largeTiles, smallTiles] = useMemo(() => {
    let largeTiles: JSX.Element[] = [];
    let smallTiles: JSX.Element[] = [];
    Object.entries(callState.callItems).forEach(([id, callItem]) => {
      const isLarge =
        isScreenShare(id) ||
        (!isLocal(id) && !containsScreenShare(callState.callItems));
      const tile = (
        <Tile
          key={id}
          videoTrack={callItem.videoTrack}
          audioTrack={callItem.audioTrack}
          isLocalPerson={isLocal(id)}
          isLoading={callItem.isLoading}
          onPress={
            isLocal(id)
              ? flipCamera
              : () => {
                  sendHello(id);
                }
          }
        />
      );
      if (isLarge) {
        largeTiles.push(tile);
      } else {
        smallTiles.push(tile);
      }
    });
    return [largeTiles, smallTiles];
  }, [callState.callItems, flipCamera, sendHello]);

  const message = getMessage(callState, props.roomUrl);

  return (
    <>
      <View
        style={[
          styles.mainContainer,
          message ? styles.messageContainer : styles.largeTilesContainerOuter,
        ]}
      >
        {message ? (
          <CallMessage
            header={message.header}
            detail={message.detail}
            isError={message.isError}
          />
        ) : (
          <View style={styles.largeTilesContainerInner}>{largeTiles}</View>
        )}
      </View>
      <View style={styles.thumbnailContainer}>{smallTiles}</View>
    </>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  thumbnailContainer: {
    paddingLeft: 10,
    position: 'absolute',
    width: '100%',
    height: '25%',
    top: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeTilesContainerOuter: {
    justifyContent: 'center',
  },
  largeTilesContainerInner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});

export default CallPanel;
