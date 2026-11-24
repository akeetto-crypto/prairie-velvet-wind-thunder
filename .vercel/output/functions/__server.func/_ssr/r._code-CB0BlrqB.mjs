import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as Route$1 } from "./router-X5meVgli.mjs";
import { t as Session } from "./session-BY70rpx_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/r._code-CB0BlrqB.js
var import_jsx_runtime = require_jsx_runtime();
function RoomPage() {
	const { code } = Route$1.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Session, {
		mode: "room",
		code
	});
}
//#endregion
export { RoomPage as component };
