import React, { useMemo, useContext, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { Item as StatusBarItem } from '../components/StatusBar';
import {
  taskResultsAtom,
  activeTaskIndexAtom,
  activeBadgeIndexAtom,
  activateTaskAtom,
  phaseStatusToColor,
  activePanelTabAtom,
  latestTaskIdByTypeAtom,
} from '../stores/status-atoms';
import StatusBar from '../components/StatusBar';
import StatusDetail from '../components/StatusDetail';
import type { ReportItem } from '../../interfaces/result-types';
import type { TaskStatusEntry } from '../stores/status/types';
import { SocketInterfaceContext } from '../services/socket-interface-context';
import { useStatusBarListener } from '../hooks/use-status-bar-listener';

/** タブキーを TrackedTask.type に変換する。未知のキーは null */
export function tabKeyToTaskType(
  key: string
): 'single' | 'multi' | 'interactive' | null {
  switch (key) {
    case 'file stdio':
      return 'single';
    case 'interactive':
      return 'interactive';
    case 'multi stdio':
      return 'multi';
    default:
      return null;
  }
}

export default function StatusShell(): JSX.Element {
  const socketInterface = useContext(SocketInterfaceContext);
  useStatusBarListener(socketInterface);

  const results = useAtomValue(taskResultsAtom);
  const activeTaskIndex = useAtomValue(activeTaskIndexAtom);
  const activeBadgeIndex = useAtomValue(activeBadgeIndexAtom);
  const activateTask = useSetAtom(activateTaskAtom);
  const setActiveBadgeIndex = useSetAtom(activeBadgeIndexAtom);
  const activePanelTab = useAtomValue(activePanelTabAtom);
  const latestTaskIdByType = useAtomValue(latestTaskIdByTypeAtom);

  // タブ切り替え時にバッジ選択状態をリセットし、別タブの detail が残らないようにする。
  // React.StrictMode での二重発火に対応するため、前回値 ref で「実際の変化」のみ検知する。
  const prevPanelTabRef = useRef(activePanelTab);
  useEffect(() => {
    if (prevPanelTabRef.current === activePanelTab) {
      return;
    }
    prevPanelTabRef.current = activePanelTab;
    setActiveBadgeIndex(null);
  }, [activePanelTab, setActiveBadgeIndex]);

  /**
   * アクティブなタブに対応する最新タスクエントリと taskResultsAtom 内のインデックス。
   * taskIdx は逆引きのコストを下げるために entry と同時に計算する。
   */
  const displayEntryWithIdx = useMemo<
    { entry: TaskStatusEntry; taskIdx: number } | undefined
  >(() => {
    const type = tabKeyToTaskType(activePanelTab);
    if (!type) return undefined;
    const latestId = latestTaskIdByType[type];
    if (latestId === null) return undefined;
    const taskIdx = results.findIndex((r) => r.taskId === latestId);
    if (taskIdx === -1) return undefined;
    return { entry: results[taskIdx], taskIdx };
  }, [activePanelTab, latestTaskIdByType, results]);

  const values: StatusBarItem[] = useMemo(() => {
    if (!displayEntryWithIdx) return [];
    const { entry: displayEntry, taskIdx } = displayEntryWithIdx;

    if (displayEntry.badges.length === 0) {
      return [
        {
          color: 'light',
          text: 'Running...',
          key: `${displayEntry.taskId}-running`,
          onClick: () => {
            activateTask(taskIdx);
            setActiveBadgeIndex(null);
          },
        },
      ];
    }
    return displayEntry.badges.map((badge, badgeIdx) => ({
      color: phaseStatusToColor(badge.status),
      text: badge.label,
      key: `${displayEntry.taskId}-${badgeIdx}`,
      onClick: () => {
        activateTask(taskIdx);
        setActiveBadgeIndex(badgeIdx);
      },
    }));
  }, [displayEntryWithIdx, activateTask, setActiveBadgeIndex]);

  const activeKey = useMemo(() => {
    if (activeTaskIndex === null || activeBadgeIndex === null) return '';
    const entry = results[activeTaskIndex];
    if (!entry) return '';
    return `${entry.taskId}-${activeBadgeIndex}`;
  }, [activeTaskIndex, activeBadgeIndex, results]);

  const detail: ReportItem[] | null = useMemo(() => {
    if (activeTaskIndex === null || activeBadgeIndex === null) return null;
    return results[activeTaskIndex]?.badges[activeBadgeIndex]?.details ?? null;
  }, [activeTaskIndex, activeBadgeIndex, results]);

  return (
    <>
      <div className="flex-elem-fix">
        <StatusBar values={values} active={activeKey} />
      </div>
      <div className="flex-elem-fix">
        {detail ? <StatusDetail details={detail} /> : <></>}
      </div>
    </>
  );
}

