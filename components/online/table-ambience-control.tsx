import type { Table, TableCommand } from '@/lib/online/types';

/** A table preference; local volume and mute remain under each listener's control. */
export function TableAmbienceControl({
  table,
  disabled,
  dispatch,
}: {
  table: Table;
  disabled: boolean;
  dispatch: (action: TableCommand) => Promise<boolean>;
}) {
  return (
    <div className="table-ambience-control">
      <label>
        <input
          type="checkbox"
          checked={table.ambienceEnabled === true}
          disabled={disabled || !table.isHost}
          onChange={(event) =>
            void dispatch({ type: 'ambience', enabled: event.target.checked })
          }
        />
        Background sounds for everyone
      </label>
      <p>
        {table.isHost
          ? 'Off by default. Players can still mute their own device.'
          : 'Controlled by the table host. You can still mute your own device.'}
      </p>
    </div>
  );
}
