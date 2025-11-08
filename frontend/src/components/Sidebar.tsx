import { TABS } from "../App.interface";
import Profile from "./Account";
import ListGroup from "./ListGroup/ListGroup";

type SidebarProps = {
  setSelectedTab: (tab: TABS) => void;
  selectedTab: TABS;
};
export const Sidebar = (props: SidebarProps) => {
  console.log("sidebar rendered");
  return (
    <>
      <div
        style={{
          backgroundColor: "rgb(40, 39, 39)",
          height: "100vh",
          width: "110%",
          padding: "20px",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <Profile />
        </div>
        <ListGroup {...props} />
      </div>
    </>
  );
};
export default Sidebar;
