import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Route } from "./router-X5meVgli.mjs";
import { t as Session } from "./session-BY70rpx_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/s._songId-BUuco_7k.js
var import_jsx_runtime = require_jsx_runtime();
function SoloPage() {
	const { songId } = Route.useParams();
	const { track } = Route.useSearch();
	const id = Number(songId);
	if (!Number.isInteger(id) || id <= 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-lg px-4 py-16 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-serif text-3xl",
			children: "Некорректная песня"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-muted",
			children: "В ссылке нет номера таба Songsterr."
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Session, {
		mode: "solo",
		songId: id,
		track
	});
}
//#endregion
export { SoloPage as component };
