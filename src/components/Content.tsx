import { TABS } from "../App.interface";
import Assets from "./Assets";
import Expenses from "./Expenses";
import Investments from "./Investments";
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
    case TABS.ASSETS:
      return <Assets />;
    case TABS.INVESTMENTS:
      return <Investments />;
    case TABS.SETTINGS:
      return <div>Settings</div>;
    case TABS.SUPPORT:
      return <div>Support</div>;
    default:
      return <div>Home</div>;
  }
};
export default Content;
