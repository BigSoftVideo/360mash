
import * as React from "react";

import { SplitPanelHor } from "./ui/split-panel-hor/split-panel-hor";
import { SplitPanelVer } from "./ui/split-panel-ver/split-panel-ver";

import "./common-style.css";
import "./app.css";

export class App extends React.Component {

    constructor(params: any) {
        super(params);
    }

    render() {
        return (
            <div className="app-contents">
                <SplitPanelVer defaultPercentage={40}>
                    <SplitPanelHor defaultPercentage={25}>
                        <div>Filter list</div>
                        <div>Filter properties</div>
                    </SplitPanelHor>
                    <SplitPanelHor defaultPercentage={75}>
                        <div>Video preview</div>
                        <div>Export options</div>
                    </SplitPanelHor>
                </SplitPanelVer>
            </div>
        );
    }

}
