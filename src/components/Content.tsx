import { TABS } from "../App.interface";
import Expenses from "./Expenses";
import HomeScreen from "./HomeScreen/HomeScreen";

type ContentProps = {
  selectedTab: TABS;
};
export const Content = (props: ContentProps) => {
  switch (props.selectedTab) {
    case TABS.HOME:
      return (
        <div>
          <HomeScreen />
        </div>
      );
    case TABS.EXPENSES:
      return <Expenses />;
    case TABS.TRIPS:
      return <div>Trips</div>;
    case TABS.APPROVALS:
      return <div>Approvals</div>;
    case TABS.SETTINGS:
      return <div>Settings</div>;
    case TABS.SUPPORT:
      return <div>Support</div>;
    default:
      return <div>Home</div>;
  }
};
export default Content;
