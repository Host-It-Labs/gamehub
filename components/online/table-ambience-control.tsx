import type { Table, TableCommand } from '@/lib/online/types';

/** The host controls ambience only; every listener controls their own effects. */
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
        Ambient sound for everyone
      </label>
      <p>
        {table.isHost
          ? 'Off by default. This does not change sound effects.'
          : 'Controlled by the table host. Your sound effects stay separate.'}
      </p>
    </div>
  );
}
