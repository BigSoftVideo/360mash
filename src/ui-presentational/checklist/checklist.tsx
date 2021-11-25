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
                        <button
                            className="movebtn"
                            onClick={this.elementMoved.bind(this, i, true)}   
                        >U</button>
                        <button
                            className="movebtn"
                            onClick={this.elementMoved.bind(this, i, false)}   
                        >D</button>
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

    protected elementMoved(index: number, movedUp: boolean) {
        let elements = this.props.elements.slice();
        let placeholder = elements[index];
        if (movedUp && index > 1) {
            elements[index] = elements[index - 1];
            elements[index - 1] = placeholder;
        }
        else if (!movedUp && index < elements.length - 1 && index != 0) {
            elements[index] = elements[index + 1];
            elements[index + 1] = placeholder;
        }
        console.log("Element moved - Index array now: " + elements[0].name, elements[1].name, elements[2].name);
        this.props.onChanged(elements);
    }
}
