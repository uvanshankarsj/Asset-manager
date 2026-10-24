import { TABS } from "../../App.interface";
import { ICON_MAP } from "./ListGroup.constant";

type ListGroupProps = {
  setSelectedTab: (tab: TABS) => void;
  selectedTab: TABS;
};

function ListGroup(props: ListGroupProps) {
  const tabs: TABS[] = [
    TABS.HOME,
    TABS.EXPENSES,
    TABS.ASSETS,
    TABS.INVESTMENTS,
    TABS.SETTINGS,
    TABS.SUPPORT,
  ];
  return (
    <>
      <ul className="nav flex-column align-items-center">
        {tabs.map((tab) => {
          return (
            <li
              key={tab}
              onClick={() => {
                props.setSelectedTab(tab);
              }}
              className="nav-item"
              style={{
                color:
                  props.selectedTab === tab
                    ? "rgb(55, 190, 13)"
                    : "rgb(205, 201, 200)",
                padding: "10px",
                display: "inline-block",
                fontSize: "20px",
                cursor: "pointer",
              }}
            >
              <img
                src={`/${ICON_MAP[tab]}`}
                style={{
                  padding: "0px 10px 0px 0px",
                  width: "40px",
                  height: "50px",
                  filter: "invert(1)",
                }}
              />

              {tab}
            </li>
          );
        })}
      </ul>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          background:
            "linear-gradient(to right, white, rgb(5, 186, 162), rgb(4, 115, 117))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontSize: "2rem",
        }}
      >
        Expensio
      </div>
    </>
  );
}
export default ListGroup;
