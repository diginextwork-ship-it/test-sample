export default function PageBackButton({
  setCurrentPage,
  fallbackPage = "home",
  label = "Back",
  className = "",
}) {
  const handleClick = () => {
    const historyStatePage = window.history.state?.page;
    const canUseHistoryBack = Boolean(historyStatePage);

    if (canUseHistoryBack) {
      window.history.back();
      return;
    }

    if (typeof setCurrentPage === "function") {
      setCurrentPage(fallbackPage);
    }
  };

  return (
    <button
      type="button"
      className={`ui-page-back-btn ${className}`.trim()}
      onClick={handleClick}
      aria-label={`${label} to previous page`}
    >
      <span aria-hidden="true">&lt;</span>
      <span>{label}</span>
    </button>
  );
}
