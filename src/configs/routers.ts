import HOME from '../pages/home.jsx';
import RENAME from '../pages/rename.jsx';
import ADMIN_LOGIN from '../pages/admin-login.jsx';
import ADMIN from '../pages/admin.jsx';
import BLANK_NAME from '../pages/blank-name.jsx';
import NAME_SELECT from '../pages/name-select.jsx';
export const routers = [{
  id: "home",
  component: HOME
}, {
  id: "rename",
  component: RENAME
}, {
  id: "admin-login",
  component: ADMIN_LOGIN
}, {
  id: "admin",
  component: ADMIN
}, {
  id: "blank-name",
  component: BLANK_NAME
}, {
  id: "name-select",
  component: NAME_SELECT
}]