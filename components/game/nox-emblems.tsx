/** Nox seat emblems: one flat pirate-flag mark per seat, drawn in the chart's
 *  cream on the black flag disc of the seat tag (the name says who it is). */
const marks = [
  // A heart run through with a sword.
  <g key="heart">
    <path d="M12 20.4 4.3 13A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 7.7 5.8Z" />
    <path d="m3.2 3.2 14.4 14.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <path d="m15.4 19.8 4.4-4.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </g>,
  // Crossed cutlasses.
  <g key="swords" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" fill="none">
    <path d="M4.5 3.5 17 16M19.5 3.5 7 16" />
    <path d="m14.6 18.4 4-4M9.4 18.4l-4-4M17.6 17.6l2.4 2.4M6.4 17.6 4 20" />
  </g>,
  // Skull and crossbones.
  <g key="skull">
    <path d="M4.2 17.8 19.8 21M19.8 17.8 4.2 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path fillRule="evenodd" d="M12 2.6c-4 0-6.8 2.8-6.8 6.4 0 2.2 1 3.7 2.5 4.6V16h8.6v-2.4c1.5-.9 2.5-2.4 2.5-4.6 0-3.6-2.8-6.4-6.8-6.4ZM9.2 8.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Zm5.6 0a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z" />
  </g>,
  // An hourglass.
  <g key="hourglass">
    <path d="M5 2.5h14v2H5zM5 19.5h14v2H5z" />
    <path d="M6.6 4.5h10.8c0 3.6-2.6 5.4-4.1 7.5 1.5 2.1 4.1 3.9 4.1 7.5H6.6c0-3.6 2.6-5.4 4.1-7.5C9.2 9.9 6.6 8.1 6.6 4.5Z" />
  </g>,
  // A crescent moon and a star.
  <g key="moon">
    <path d="M13.6 3.3A8.7 8.7 0 1 0 20.7 16 7 7 0 0 1 13.6 3.3Z" />
    <path d="m18.2 3.2.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9Z" />
  </g>,
  // An eight-pointed compass star.
  <g key="star">
    <path d="m12 1.8 2.2 7.9 7.9 2.3-7.9 2.2L12 22.2l-2.2-8L1.8 12l8-2.3Z" />
    <path d="m5.7 5.7 4 2.9M18.3 5.7l-2.9 4M18.3 18.3l-4-2.9M5.7 18.3l2.9-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </g>,
];

export function SeatEmblem({ seat }: { seat: number }) {
  return (
    <svg className="seat-emblem" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {marks[seat % marks.length]}
    </svg>
  );
}
