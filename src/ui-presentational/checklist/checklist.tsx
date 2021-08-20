import "./checklist.css";

import * as React from "react";

export interface ChecklistElement {
    name: string;
    checked: boolean;
    selected: boolean;
}

export interface ChecklistProps {
    elements: ChecklistElement[];
    onChanged: (newElements: ChecklistElement[]) => void;

    /** True if the elements can be selected */
    selectable: boolean;
}

/**
 * A checklist with elements that can be re-ordered.
 */
export class Checklist extends React.Component<ChecklistProps> {
    render() {
        let items = this.props.elements.map((element, i) => {
            let background = "transparent";
            if (element.selected) {
                background = "#52abff";
            }
            return (
                <li key={i}>
                    <label>
                        <input
                            type="checkbox"
                            checked={element.checked}
                            onChange={this.elementToggled.bind(this, i)}
                        ></input>
                    </label>
                    <span
                        className="checklist-item-name"
                        onClick={this.elementSelected.bind(this, i)}
                        style={{ backgroundColor: background }}
                    >
                        {element.name}
                    </span>
                </li>
            );
        });
        return <ol className="checklist-root">{items}</ol>;
    }

    protected elementToggled(index: number) {
        let elements = this.props.elements.slice();
        elements[index].checked = !elements[index].checked;
        this.props.onChanged(elements);
    }

    protected elementSelected(index: number) {
        console.log("element selected was invoked");
        let elements = this.props.elements.slice();
        for (let element of elements) {
            element.selected = false;
        }
        elements[index].selected = true;
        this.props.onChanged(elements);
    }
}
