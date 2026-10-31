import { TABS } from "../App.interface";
import type { AuthUser } from "../api";
import Profile from "./Account";
import ListGroup from "./ListGroup/ListGroup";

type SidebarProps = {
  setSelectedTab: (tab: TABS) => void;
  selectedTab: TABS;
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
  onLogout: () => void;
};
export const Sidebar = ({ user, onUserChange, onLogout, ...listProps }: SidebarProps) => {
  return (
    <>
      <div
        style={{
          backgroundColor: "rgb(40, 39, 39)",
          width: "100%",
          padding: "20px",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <Profile user={user} onUserChange={onUserChange} />
        </div>
        <ListGroup {...listProps} />
        <div className="sidebar-logout" style={{ textAlign: "center" }}>
          <button className="btn btn-outline-light btn-sm" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </>
  );
};
export default Sidebar;
