import * as React from "react";

export interface ChecklistElement {
    name: string;
    checked: boolean;
}

export interface ChecklistProps {
    elements: ChecklistElement[];
    onChanged: (newElements: ChecklistElement[]) => void;
}

/**
 * A checklist with elements that can be re-ordered.
 */
export class Checklist extends React.Component<ChecklistProps> {
    render() {
        let items = this.props.elements.map((element, i) => {
            return (
                <li key={i}>
                    <label>
                        <input
                            type="checkbox"
                            checked={element.checked}
                            onChange={this.elementToggled.bind(this, i)}
                        ></input>
                    </label>
                    {/*<button>O</button>*/}
                    {/* Put the onClick listener on this span */}
                    <span>{element.name}</span>
                </li>
            );
        });
        return <ol>{items}</ol>;
    }

    protected elementToggled(index: number) {
        let elements = this.props.elements.slice();
        elements[index].checked = !elements[index].checked;
        this.props.onChanged(elements);
    }
}
