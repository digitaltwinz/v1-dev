import * as React from 'react';

import { Box, IconButton } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { animationEnterBelow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamCard, beamCardClasses, beamCardMessageScrollingSx, beamCardMessageSx, beamCardMessageWrapperSx } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { FusionControlsMemo } from './FusionControls';
import { FusionInstructionsEditor } from './FusionInstructionsEditor';
import { GATHER_COLOR } from '../beam.config';
import { findFusionFactory } from './instructions/beam.gather.factories';
import { fusionIsEditable, fusionIsError, fusionIsFusing, fusionIsIdle, fusionIsStopped, fusionIsUsableOutput } from './beam.gather';
import { useBeamCardScrolling } from '../store-module-beam';
import { useMessageAvatarLabel } from '~/common/util/dMessageUtils';


export function Fusion(props: {
  beamStore: BeamStoreApi,
  fusionId: string,
  isMobile: boolean,
}) {

  // state
  const [showLlmSelector, setShowLlmSelector] = React.useState(false);

  // external state
  const fusion = useBeamStore(props.beamStore, store => store.fusions.find(fusion => fusion.fusionId === props.fusionId) ?? null);
  const cardScrolling = useBeamCardScrolling();

  // derived state
  const isEditable = fusionIsEditable(fusion);
  const isIdle = fusionIsIdle(fusion);
  const isError = fusionIsError(fusion);
  const isFusing = fusionIsFusing(fusion);
  const isStopped = fusionIsStopped(fusion);
  const isUsable = fusionIsUsableOutput(fusion);
  const showUseButtons = isUsable && !isFusing;
  const { tooltip: fusionAvatarTooltip } = useMessageAvatarLabel(fusion?.outputDMessage, 'pro');

  const factory = findFusionFactory(fusion?.factoryId);

  const { removeFusion, toggleFusionGathering, fusionSetLlmId } = props.beamStore.getState();

  // get LLM Label and Vendor Icon
  const llmId = fusion?.llmId ?? null;
  const setLlmId = React.useCallback((llmId: DLLMId | null) => fusionSetLlmId(props.fusionId, llmId), [props.fusionId, fusionSetLlmId]);
  const [llmOrNull, llmComponent, llmVendorIcon] = useLLMSelect(llmId, setLlmId, {
    label: '',
    disabled: isFusing,
  });

  // hide selector when fusion starts
  React.useEffect(() => {
    isFusing && setShowLlmSelector(false);
  }, [isFusing]);

  // more derived
  const llmLabel = llmOrNull?.label || 'Model unknown';

  // handlers
  const handleFusionCopyToClipboard = React.useCallback(() => {
    const { fusions } = props.beamStore.getState();
    const fusion = fusions.find(fusion => fusion.fusionId === props.fusionId);
    if (fusion?.outputDMessage?.fragments.length)
      copyToClipboard(messageFragmentsReduceText(fusion.outputDMessage.fragments), 'Merge');
  }, [props.beamStore, props.fusionId]);

  const handleFusionUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { fusions, onSuccessCallback } = props.beamStore.getState();
    const fusion = fusions.find(fusion => fusion.fusionId === props.fusionId);
    if (fusion?.outputDMessage?.fragments.length && onSuccessCallback)
      onSuccessCallback(fusion.outputDMessage);
  }, [props.beamStore, props.fusionId]);

  const handleIconClick = React.useCallback((event: React.MouseEvent) => {
    if (event.shiftKey) {
      const fusion = props.beamStore.getState().fusions.find(fusion => fusion.fusionId === props.fusionId);
      console.log({ fusion });
      return;
    }
    // Toggle LLM selector
    setShowLlmSelector(!showLlmSelector);
  }, [showLlmSelector, props.beamStore, props.fusionId]);

  const handleFusionRemove = React.useCallback(() => {
    removeFusion(props.fusionId);
  }, [props.fusionId, removeFusion]);

  const handleToggleFusionGather = React.useCallback(() => {
    toggleFusionGathering(props.fusionId);
  }, [props.fusionId, toggleFusionGathering]);

  // escape hatch: no factory, no fusion - nothing to do
  if (!fusion || !factory)
    return;

  return (
    <BeamCard
      role='beam-card'
      tabIndex={-1}
      className={
        // (isIdle ? beamCardClasses.fusionIdle : '')
        (isError ? beamCardClasses.errored + ' ' : '')
        + ((isUsable || isFusing || isIdle) ? beamCardClasses.selectable + ' ' : '')
        + (isFusing ? beamCardClasses.attractive + ' ' : '')
        // + (beamCardClasses.smashTop + ' ')
      }
    >

      {/* Controls Row */}
      <FusionControlsMemo
        fusion={fusion}
        factory={factory}
        isFusing={isFusing}
        isInterrupted={isStopped}
        isMobile={props.isMobile}
        isUsable={isUsable}
        llmComponent={(isFusing || !showLlmSelector) ? undefined : llmComponent}
        llmLabel={llmLabel}
        llmVendorIcon={llmVendorIcon}
        fusionAvatarTooltip={fusionAvatarTooltip}
        onIconClick={isFusing ? undefined : handleIconClick}
        onRemove={handleFusionRemove}
        onToggleGenerate={handleToggleFusionGather}
      />

      {isEditable && (
        <FusionInstructionsEditor
          beamStore={props.beamStore}
          factory={factory}
          fusionId={props.fusionId}
          instructions={fusion.instructions}
          isFusing={isFusing}
          isIdle={isIdle}
          onStart={handleToggleFusionGather}
        />
      )}

      {/* Show issue, if any */}
      {isError && <InlineError error={fusion?.errorText || 'Merge Issue'} />}


      {/* Dynamic: instruction-specific components */}
      {!!fusion?.fusingInstructionComponent && fusion.fusingInstructionComponent}

      {/* Output Message */}
      {(!!fusion?.outputDMessage?.fragments.length || fusion?.stage === 'fusing') && (
        <Box sx={beamCardMessageWrapperSx}>
          {!!fusion.outputDMessage && (
            <ChatMessageMemo
              message={fusion.outputDMessage}
              fitScreen={true}
              isMobile={props.isMobile}
              hideAvatar
              showUnsafeHtmlCode={true}
              adjustContentScaling={-1}
              sx={!cardScrolling ? beamCardMessageSx : beamCardMessageScrollingSx}
            />
          )}
        </Box>
      )}


      {/* Use Fusion */}
      {showUseButtons && (
        <Box sx={{ mt: 'auto', mb: -1, mr: -1, placeSelf: 'end', display: 'flex', gap: 1 }}>

          {/* Copy */}
          <GoodTooltip title='Copy'>
            <IconButton
              onClick={handleFusionCopyToClipboard}
            >
              <ContentCopyIcon sx={{ fontSize: 'md' }} />
            </IconButton>
          </GoodTooltip>

          {/* Continue */}
          <GoodTooltip title='Use this message'>
            <IconButton
              size='sm'
              // variant='plain'
              color={GATHER_COLOR}
              disabled={isFusing}
              onClick={handleFusionUse}
              // endDecorator={<TelegramIcon />}
              sx={{
                // ...BEAM_BTN_SX,
                fontSize: 'xs',
                // '--Icon-fontSize': 'var(--joy-fontSize-xl)',
                // backgroundColor: 'background.popup',
                // border: '1px solid',
                // borderColor: `${GATHER_COLOR}.outlinedBorder`,
                // boxShadow: `0 4px 16px -4px rgb(var(--joy-palette-${GATHER_COLOR}-mainChannel) / 20%)`,
                animation: `${animationEnterBelow} 0.1s ease-out`,
                whiteSpace: 'nowrap',
              }}
            >
              {/*Use*/}
              <TelegramIcon />
            </IconButton>
          </GoodTooltip>

        </Box>
      )}

    </BeamCard>
  );
}