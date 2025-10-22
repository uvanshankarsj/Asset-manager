import Sidebar from "./components/Sidebar";
import Content from "./components/Content";
import { useState } from "react";
import { TABS } from "./App.interface";

function app() {
  const [selectedTab, setSelectedTab] = useState<TABS>(TABS.HOME);

  return (
    <>
      <div className="grid-container ">
        <div className="row">
          <div className="col-3" style={{ width: "20%" }}>
            <Sidebar
              setSelectedTab={setSelectedTab}
              selectedTab={selectedTab}
            />
          </div>
          <div className="col-9" style={{ width: "80%" }}>
            <Content selectedTab={selectedTab} />
          </div>
        </div>
      </div>
    </>
  );
}
export default app;
