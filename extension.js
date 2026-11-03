import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Workspace } from 'resource:///org/gnome/shell/ui/workspace.js';
import {
  GroupCyclerPopup,
  WindowCyclerPopup,
  WindowSwitcherPopup,
} from 'resource:///org/gnome/shell/ui/altTab.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const isOverviewWindow = Workspace.prototype._isOverviewWindow;
const origDoAddWindow = Workspace.prototype._doAddWindow;
const groupGetWindows = GroupCyclerPopup.prototype._getWindows;
const windowGetWindows = WindowCyclerPopup.prototype._getWindows;
const windowSwitcherWindows = WindowSwitcherPopup.prototype._getWindowList;

function _filterWindows(windows) {
  return windows.filter(w => !w.minimized);
}

function _getWorkspaces() {
  const workspaces = [];
  const views = Main.overview._overview?._controls?._workspacesDisplay?._workspacesViews ?? [];
  for (const view of views) {
    if (view._workspaces)
      workspaces.push(...view._workspaces);
    if (view._workspace)
      workspaces.push(view._workspace);
    if (view._workspacesView) {
      if (view._workspacesView._workspaces)
        workspaces.push(...view._workspacesView._workspaces);
      if (view._workspacesView._workspace)
        workspaces.push(view._workspacesView._workspace);
    }
  }
  return workspaces;
}

export default class HideMinimized extends Extension {
  enable() {
    Workspace.prototype._isOverviewWindow = function (win) {
      const show = isOverviewWindow.call(this, win);
      const meta = win.get_meta_window ? win.get_meta_window() : win;
      return show && !meta.minimized;
    };

    Workspace.prototype._doAddWindow = function (metaWin) {
      if (!this._minimizedWindows)
        this._minimizedWindows = new Set();

      if (!this._minimizedWindows.has(metaWin)) {
        metaWin.connectObject('notify::minimized', () => {
          if (metaWin.minimized)
            this._doRemoveWindow(metaWin);
          else
            this._doAddWindow(metaWin);
        }, this);
        this._minimizedWindows.add(metaWin);
      }

      return origDoAddWindow.call(this, metaWin);
    };

    WindowCyclerPopup.prototype._getWindows = function () {
      return _filterWindows(windowGetWindows.call(this));
    };

    GroupCyclerPopup.prototype._getWindows = function () {
      return _filterWindows(groupGetWindows.call(this));
    };

    WindowSwitcherPopup.prototype._getWindowList = function () {
      return _filterWindows(windowSwitcherWindows.call(this));
    };

    // Apply immediately to already existing workspaces and windows
    for (const ws of _getWorkspaces()) {
      if (!ws._minimizedWindows)
        ws._minimizedWindows = new Set();

      for (const actor of global.get_window_actors()) {
        const metaWin = actor.meta_window;
        if (!metaWin)
          continue;

        if (!ws._minimizedWindows.has(metaWin)) {
          metaWin.connectObject('notify::minimized', () => {
            if (metaWin.minimized)
              ws._doRemoveWindow(metaWin);
            else
              ws._doAddWindow(metaWin);
          }, ws);
          ws._minimizedWindows.add(metaWin);
        }

        if (metaWin.minimized)
          ws._doRemoveWindow(metaWin);
      }
    }
  }

  disable() {
    Workspace.prototype._isOverviewWindow = isOverviewWindow;
    Workspace.prototype._doAddWindow = origDoAddWindow;
    WindowCyclerPopup.prototype._getWindows = windowGetWindows;
    GroupCyclerPopup.prototype._getWindows = groupGetWindows;
    WindowSwitcherPopup.prototype._getWindowList = windowSwitcherWindows;

    for (const ws of _getWorkspaces()) {
      for (const actor of global.get_window_actors()) {
        const metaWin = actor.meta_window;
        if (!metaWin)
          continue;

        metaWin.disconnectObject(ws);

        if (metaWin.minimized)
          ws._doAddWindow(metaWin);
      }
      delete ws._minimizedWindows;
    }
  }
}
