import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Alert, Box, CircularProgress } from '@mui/joy';

import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { useUICounter } from '~/common/stores/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamFusionGrid } from './gather/BeamFusionGrid';
import { BeamGatherPane } from './gather/BeamGatherPane';
import { BeamRayGrid } from './scatter/BeamRayGrid';
import { BeamScatterInput } from './scatter/BeamScatterInput';
import { BeamScatterPane } from './scatter/BeamScatterPane';
import { BeamStoreApi, useBeamStore } from './store-beam.hooks';
import { useModuleBeamStore } from './store-module-beam';


export function BeamView(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  showExplainer?: boolean,
  // sx?: SxProps,
}) {

  // state
  const [hasAutoMerged, setHasAutoMerged] = React.useState(false);
  const [warnIsScattering, setWarnIsScattering] = React.useState(false);

  // external state
  const { novel: explainerUnseen, touch: explainerCompleted, forget: explainerShow } = useUICounter('beam-wizard');
  const { cardAdd, gatherAutoStartAfterScatter } = useModuleBeamStore(useShallow(state => ({
    cardAdd: state.cardAdd,
    gatherAutoStartAfterScatter: state.gatherAutoStartAfterScatter,
  })));
  const {
    /* root */ inputHistoryReplaceMessageFragment,
    /* scatter */ setRayCount, startScatteringAll, stopScatteringAll,
  } = props.beamStore.getState();
  const {
    /* root */ inputHistory, inputIssues, inputReady,
    /* scatter */ hadImportedRays, isScattering, raysReady,
    /* gather (composite) */ canGather,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    // input
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    inputReady: state.inputReady,
    // scatter
    hadImportedRays: state.hadImportedRays,
    isScattering: state.isScattering,
    raysReady: state.raysReady,
    // gather (composite)
    canGather: state.raysReady >= 2 && state.currentFactoryId !== null && state.currentGatherLlmId !== null,
  })));
  // the following are independent because of useShallow, which would break in the above call
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const fusionIds = useBeamStore(props.beamStore, useShallow(state => state.fusions.map(fusion => fusion.fusionId)));

  // derived state
  const raysCount = rayIds.length;


  // handlers

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);

  const handleRaysOperation = React.useCallback((operation: 'copy' | 'use') => {
    const { rays, onSuccessCallback } = props.beamStore.getState();
    const allFragments = rays.flatMap(ray => ray.message.fragments);
    if (allFragments.length) {
      switch (operation) {
        case 'copy':
          const combinedText = messageFragmentsReduceText(allFragments, '\n\n\n---\n\n\n');
          copyToClipboard(combinedText, 'All Beams');
          break;
        case 'use':
          onSuccessCallback?.({ fragments: allFragments });
          break;
      }
    }
  }, [props.beamStore]);

  const handleScatterStart = React.useCallback((restart: boolean) => {
    setHasAutoMerged(false);
    startScatteringAll(restart);
  }, [startScatteringAll]);


  const handleCreateFusion = React.useCallback(() => {
    // if scatter is busy, ask for confirmation
    if (isScattering) {
      setWarnIsScattering(true);
      return;
    }
    props.beamStore.getState().createFusion();
  }, [isScattering, props.beamStore]);


  const handleStartMergeConfirmation = React.useCallback(() => {
    setWarnIsScattering(false);
    stopScatteringAll();
    handleCreateFusion();
  }, [handleCreateFusion, stopScatteringAll]);

  const handleStartMergeDenial = React.useCallback(() => setWarnIsScattering(false), []);


  // auto-merge
  const shallAutoMerge = gatherAutoStartAfterScatter && canGather && !isScattering && !hasAutoMerged;
  React.useEffect(() => {
    if (shallAutoMerge) {
      setHasAutoMerged(true);
      handleStartMergeConfirmation();
    }
  }, [handleStartMergeConfirmation, shallAutoMerge]);

  // (great ux) scatter finished while the "start merge" (warning) dialog is up: dismiss dialog and proceed
  // here we assume that 'warnIsScattering' shows the intention of the user to proceed with a merge asap
  const shallResumeMerge = warnIsScattering && !isScattering && !gatherAutoStartAfterScatter;
  React.useEffect(() => {
    if (shallResumeMerge)
      handleStartMergeConfirmation();
  }, [handleStartMergeConfirmation, shallResumeMerge]);


  // runnning

  // [effect] pre-populate a default number of rays
  // const bootup = raysCount < SCATTER_RAY_DEF;
  // React.useEffect(() => {
  //   bootup && handleRaySetCount(SCATTER_RAY_DEF);
  // }, [bootup, handleRaySetCount]);


  // intercept ctrl+enter and esc
  useGlobalShortcuts('BeamView', React.useMemo(() => [
    { key: ShortcutKey.Enter, ctrl: true, action: () => handleScatterStart(false), disabled: isScattering, level: 1 },
    ...(isScattering ? [{ key: ShortcutKey.Esc, action: stopScatteringAll, level: 10 + 1 /* becasuse > ChatBarAltBeam */ }] : []),
  ], [handleScatterStart, isScattering, stopScatteringAll]));


  // Explainer, if unseen
  if (props.showExplainer && explainerUnseen)
    return <BeamExplainer onWizardComplete={explainerCompleted} />;

  return <>

    <Box role='beam-list' sx={{
      // scroller fill
      minHeight: '100%',
      // ...props.sx,

      // enter animation
      // NOTE: disabled: off-putting/confusing when the beam content is large - things won't combine nicely
      // animation: `${animationEnterScaleUp} 5s cubic-bezier(.17,.84,.44,1)`,

      // config
      '--Pad': { xs: '1rem', md: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) / 2)',

      // layout
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--Pad)',
    }}>

      {/* Config Issues */}
      {!!inputIssues && <Alert>{inputIssues}</Alert>}


      {/* User Message */}
      <BeamScatterInput
        isMobile={props.isMobile}
        history={inputHistory}
        onMessageFragmentReplace={inputHistoryReplaceMessageFragment}
      />

      {/* Scatter Controls */}
      <BeamScatterPane
        beamStore={props.beamStore}
        isMobile={props.isMobile}
        rayCount={raysCount}
        setRayCount={handleRaySetCount}
        showRayAdd={!cardAdd}
        startEnabled={inputReady}
        startBusy={isScattering}
        startRestart={!props.isMobile && raysReady >= 1 && raysReady < raysCount && !isScattering}
        onStart={handleScatterStart}
        onStop={stopScatteringAll}
        onExplainerShow={explainerShow}
      />


      {/* Rays Grid - BeamRay[] > <ChatMessage /> */}
      <BeamRayGrid
        beamStore={props.beamStore}
        isMobile={props.isMobile}
        rayIds={rayIds}
        showRayAdd={cardAdd}
        showRaysOps={(isScattering || raysReady < 2) ? undefined : raysReady}
        hadImportedRays={hadImportedRays}
        onIncreaseRayCount={handleRayIncreaseCount}
        onRaysOperation={handleRaysOperation}
        // linkedLlmId={currentGatherLlmId}
      />


      {/* Gapper between Rays and Merge, without compromising the auto margin of the Ray Grid */}
      <Box />


      {/* Gather Controls */}
      <BeamGatherPane
        beamStore={props.beamStore}
        canGather={canGather}
        isMobile={props.isMobile}
        // onAddFusion={handleCreateFusion}
        raysReady={raysReady}
      />

      {/* Fusion Grid - Fusion[] > <ChatMessage /> */}
      <BeamFusionGrid
        beamStore={props.beamStore}
        canGather={canGather}
        fusionIds={fusionIds}
        isMobile={props.isMobile}
        onAddFusion={handleCreateFusion}
        raysCount={raysCount}
      />

    </Box>


    {/* Confirm Stop Scattering */}
    {warnIsScattering && (
      <ConfirmationModal
        open
        onClose={handleStartMergeDenial}
        onPositive={handleStartMergeConfirmation}
        // lowStakes
        noTitleBar
        confirmationText='Some responses are still being generated. Do you want to stop and proceed with merging the available responses now?'
        positiveActionText='Proceed with Merge'
        negativeActionText='Wait for All Responses'
        negativeActionStartDecorator={
          <CircularProgress color='neutral' sx={{ '--CircularProgress-size': '24px', '--CircularProgress-trackThickness': '1px' }} />
        }
      />
    )}

  </>;
}


/* Commented code with a callout box to explain the first message
  <Box>
    <CalloutTopRightIcon sx={{ color: 'primary.solidBg', fontSize: '2.53rem', rotate: '-10deg' }} />
    <Chip
      color='primary'
      variant='solid'
      endDecorator={<ChipDelete onClick={() => alert('aa')} />}
      sx={{
        mx: -2,
        py: 1,
        px: 2,
      }}
    >
      Last message in the conversation
    </Chip>
  </Box>
*/