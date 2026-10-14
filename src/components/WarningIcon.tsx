export function WarningIcon({ size = 18 }: { size?: number }) {
  return <img
    src="/warning-circle-svgrepo-com.svg"
    alt=""
    aria-hidden="true"
    width={size}
    height={size}
    className="warning-circle-icon"
  />;
}
