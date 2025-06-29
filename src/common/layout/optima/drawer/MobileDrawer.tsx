import * as React from 'react';

import { Box, Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { MobileNavItems } from '../nav/MobileNavItems';
import { OPTIMA_DRAWER_BACKGROUND, OPTIMA_DRAWER_MOBILE_RADIUS } from '../optima.config';
import { optimaCloseDrawer, useOptimaDrawerOpen } from '../useOptima';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


function DrawerContentPortal() {
  const drawerPortalRef = useOptimaPortalOutRef('optima-portal-drawer', 'MobileDrawer');
  return (
    <Box
      ref={drawerPortalRef}
      sx={{
        // make this compressible
        overflow: 'hidden',
        // expand to fix - note: relies on contents being scrollable
        flex: 1,
        // layout: column
        display: 'flex',
        flexDirection: 'column',
        // (optional) style: cast shadow to the nav items
        // zIndex: 1,
        // boxShadow: '0 2px 4px rgb(var(--joy-palette-neutral-darkChannel) / 14%)',
      }}
    />
  );
}

export function MobileDrawer(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const isDrawerOpen = useOptimaDrawerOpen();

  /* NOTE on `disableEnforceFocus`:
   * This is a workaround for mobile drawer focus issues, when pressing the 3-dot menu button
   * on the `Search...` input field will flash-and-hide the menu.
   *
   * This prop disables the default focus trap behavior of the Drawer.
   * It allows focus to move freely outside the Drawer, which is useful
   * when the Drawer contains components (like Menus) that need to manage
   * their own focus.
   *
   * This prevents unexpected focus resets to the Drawer content when interacting with
   * nested interactive elements.
   *
   * See also `windowUtils.useDocumentFocusDebugger` for debugging focus issues.
   */
  return (
    <Drawer
      id='mobile-drawer'
      component={props.component}
      disableEnforceFocus
      open={isDrawerOpen}
      onClose={optimaCloseDrawer}
      sx={{
        '--Drawer-horizontalSize': 'round(clamp(30%, var(--AGI-Mobile-Drawer-width), 100%), 1px)',
        '--Drawer-transitionDuration': '0.2s',
        // '& .MuiDrawer-paper': {
        //   width: 256,
        //   boxSizing: 'border-box',
        // },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'none',
          },
        },
        content: {
          sx: {
            // style: round the right drawer corners
            backgroundColor: OPTIMA_DRAWER_BACKGROUND,
            borderTopRightRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
            borderBottomRightRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
            // boxShadow: 'none',
          },
        },
      }}
    >

      {/* Insertion point for the Drawer - expands even if empty */}
      <DrawerContentPortal />

      {/* [Mobile] Nav Items */}
      <MobileNavItems currentApp={props.currentApp} />

    </Drawer>
  );
}
