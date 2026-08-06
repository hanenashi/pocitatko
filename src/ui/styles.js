export function addStyles(ids) {
  if (document.getElementById(ids.style)) return;
  const style = document.createElement("style");
  style.id = ids.style;
  style.textContent = `
    #${ids.launcher} { position: fixed; z-index: 2147483000; border: 0; border-radius: 999px; padding: 10px 15px; background: #26231f; color: #fff; box-shadow: 0 5px 20px #0004; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; font: 700 14px system-ui, sans-serif; }
    #${ids.launcher}.dragging { cursor: grabbing; }
    #${ids.overlay} { box-sizing: border-box; position: fixed; z-index: 2147483001; inset: 2vh 2vw; display: flex; flex-direction: column; overflow: hidden; color: #28241e; background: #f5f1e8; border: 1px solid #9f9789; border-radius: 16px; box-shadow: 0 18px 70px #0008; font: 14px/1.45 system-ui, sans-serif; }
    #${ids.overlay} * { box-sizing: border-box; }
    #${ids.overlay} [data-pocitatko-header] { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px 14px; background: #fffdf8; border-bottom: 1px solid #d7d0c5; }
    #${ids.overlay} [data-pocitatko-header] h2 { margin: 0 auto 0 0; font-size: 18px; }
    #${ids.overlay} button { border: 1px solid #aaa093; border-radius: 8px; padding: 8px 11px; background: #fffdf8; color: inherit; cursor: pointer; font: inherit; }
    #${ids.overlay} button.primary { border-color: #725914; background: #f0c957; font-weight: 700; }
    #${ids.overlay} button:disabled { opacity: .55; cursor: wait; }
    #${ids.overlay} [data-pocitatko-body] { min-height: 0; flex: 1; overflow: auto; padding: 16px; }
    #${ids.overlay} [data-pocitatko-intro] { max-width: 900px; margin: 0 auto 14px; padding: 12px 14px; border-radius: 10px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-error] { max-width: 900px; margin: 0 auto 14px; padding: 10px 12px; border-radius: 8px; background: #ffd9d3; color: #70251b; }
    #${ids.overlay} [data-pocitatko-grid] { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    #${ids.overlay} [data-pocitatko-source-card] { display: flex; flex-direction: column; min-width: 0; padding: 9px; border: 2px solid transparent; border-radius: 12px; background: #fffdf8; cursor: pointer; }
    #${ids.overlay} [data-pocitatko-source-card].selected { border-color: #a87900; box-shadow: 0 0 0 3px #f0c95755; }
    #${ids.overlay} [data-pocitatko-source-card] img { width: 100%; aspect-ratio: 1/1; border-radius: 8px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-source-card] strong { margin-top: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #${ids.overlay} [data-pocitatko-source-card] small { color: #6d665d; }
    #${ids.overlay} [data-pocitatko-confirm] { position: sticky; bottom: 0; display: grid; grid-template-columns: 92px 1fr auto; align-items: center; gap: 12px; max-width: 900px; margin: 16px auto 0; padding: 10px; border: 1px solid #bfa34f; border-radius: 12px; background: #fff8d9; box-shadow: 0 6px 24px #0003; }
    #${ids.overlay} [data-pocitatko-confirm] img { width: 92px; height: 72px; border-radius: 7px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-boundary] { grid-column: 2 / -1; display: grid; gap: 4px; }
    #${ids.overlay} [data-pocitatko-boundary] select { max-width: 100%; padding: 7px; border: 1px solid #aaa093; border-radius: 7px; background: #fffdf8; font: inherit; }
    #${ids.overlay} [data-pocitatko-round] { display: grid; grid-template-columns: minmax(220px, .6fr) minmax(340px, 1.4fr); min-height: 100%; }
    #${ids.overlay} [data-pocitatko-prompt] { position: sticky; top: 0; align-self: start; padding: 14px; }
    #${ids.overlay} [data-pocitatko-prompt] > img { display: block; max-width: 100%; max-height: 56vh; margin: 10px auto; border-radius: 9px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-candidates] { padding: 14px; border-left: 1px solid #d7d0c5; }
    #${ids.overlay} [data-pocitatko-candidate] { margin: 0 0 14px; padding: 12px; border: 2px solid transparent; border-radius: 12px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-candidate].suggested { border-color: #d0a51d; }
    #${ids.overlay} [data-pocitatko-candidate].winner { border-color: #23804b; box-shadow: 0 0 0 3px #23804b22; }
    #${ids.overlay} [data-pocitatko-candidate] header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; }
    #${ids.overlay} [data-pocitatko-candidate] header small, #${ids.overlay} [data-pocitatko-muted] { color: #6d665d; }
    #${ids.overlay} [data-pocitatko-candidate] img { display: block; max-width: 100%; max-height: 520px; margin: 10px auto; border-radius: 8px; object-fit: contain; background: #e8e2d8; }
    #${ids.overlay} [data-pocitatko-score] { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    #${ids.overlay} [data-pocitatko-chip] { padding: 3px 8px; border-radius: 999px; background: #eee8dc; font-size: 12px; }
    #${ids.overlay} details { margin-top: 8px; }
    #${ids.overlay} [data-pocitatko-reactions] { margin: 7px 0 0; padding-left: 21px; }
    #${ids.overlay} [data-pocitatko-reactions] li { display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 8px; margin: 5px 0; }
    #${ids.overlay} [data-pocitatko-reactions] li.excluded { opacity: .55; text-decoration: line-through; }
    #${ids.overlay} [data-pocitatko-reactions] button { padding: 3px 7px; font-size: 12px; text-decoration: none; }
    #${ids.overlay} [data-pocitatko-admin-intro], #${ids.overlay} [data-pocitatko-admin-form], #${ids.overlay} [data-pocitatko-admin-list] { max-width: 980px; margin: 0 auto 14px; }
    #${ids.overlay} [data-pocitatko-admin-intro] { padding: 14px; border-radius: 12px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-admin-intro] h3 { margin-top: 0; }
    #${ids.overlay} [data-pocitatko-admin-form] { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px; border: 1px solid #d7d0c5; border-radius: 12px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-admin-form] label:not([data-pocitatko-admin-enabled]) { display: grid; gap: 5px; }
    #${ids.overlay} [data-pocitatko-admin-form] input[type="text"], #${ids.overlay} [data-pocitatko-admin-form] input[type="email"] { min-width: 0; width: 100%; border: 1px solid #aaa093; border-radius: 8px; padding: 9px 10px; background: #fffdf8; color: inherit; font: inherit; }
    #${ids.overlay} [data-pocitatko-admin-enabled] { display: flex; align-items: center; }
    #${ids.overlay} [data-pocitatko-admin-list] { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
    #${ids.overlay} [data-pocitatko-admin-list] > h3 { grid-column: 1 / -1; margin-bottom: 0; }
    #${ids.overlay} [data-pocitatko-admin-card] { min-width: 0; padding: 12px; border: 1px solid #d7d0c5; border-radius: 12px; background: #fffdf8; }
    #${ids.overlay} [data-pocitatko-admin-card].disabled { opacity: .62; }
    #${ids.overlay} [data-pocitatko-admin-card] header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    #${ids.overlay} [data-pocitatko-admin-card] code { display: block; overflow-wrap: anywhere; margin: 8px 0; }
    #${ids.overlay} [data-pocitatko-admin-card] > div { display: flex; flex-wrap: wrap; gap: 7px; }
    #${ids.overlay} a { color: #755800; }
    @media (max-width: 900px) {
      #${ids.overlay} { inset: 0; border-radius: 0; }
      #${ids.overlay} [data-pocitatko-body] { padding: 10px; }
      #${ids.overlay} [data-pocitatko-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      #${ids.overlay} [data-pocitatko-confirm] { grid-template-columns: 72px 1fr; }
      #${ids.overlay} [data-pocitatko-confirm] img { width: 72px; height: 62px; }
      #${ids.overlay} [data-pocitatko-boundary] { grid-column: 1 / -1; }
      #${ids.overlay} [data-pocitatko-confirm] button { grid-column: 1 / -1; }
      #${ids.overlay} [data-pocitatko-round] { display: block; }
      #${ids.overlay} [data-pocitatko-prompt] { position: static; }
      #${ids.overlay} [data-pocitatko-prompt] > img { max-height: 34vh; }
      #${ids.overlay} [data-pocitatko-candidates] { padding: 10px 0; border: 0; }
      #${ids.overlay} [data-pocitatko-candidate] img { max-height: 42vh; }
      #${ids.overlay} [data-pocitatko-admin-form] { grid-template-columns: 1fr; }
      #${ids.overlay} [data-pocitatko-admin-list] { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}
