import "./checklist.css";

import * as React from "react";

export interface ChecklistElement {
    name: string;
    checked: boolean;
    selected: boolean;
}
export interface ChecklistState {
    index: number;
    cName: string;
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
export class Checklist extends React.Component<ChecklistProps, ChecklistState> {
    draggedId: number | undefined;
    constructor(props: ChecklistProps) {
        super(props);
        this.state = {
            index: 0,
            cName: "",
        };
    }

    render() {
        console.log("running render");
        let items = this.props.elements.map((element, i) => {
            let background = "transparent";
            if (element.selected) {
                background = "#52abff";
            }
            return (
                <li
                    key={i}
                    className={this.state.index == i ? this.state.cName : ""}
                    draggable={true}
                    onDragStart={this.dragStartHandler.bind(this, i)}
                    onDragOver={this.dragOverHandler.bind(this, i)}
                    onDrop={this.dropHandler.bind(this, i)}
                    onDragLeave={this.dragOverExitHandler.bind(this, i)}
                    onDragEnd={this.dragEndHandler.bind(this)}
                >
                    <label>
                        <input
                            type="checkbox"
                            checked={element.checked}
                            onChange={this.elementToggled.bind(this, i)}
                        ></input>
                        {/* <button
                            className="movebtn"
                            onClick={this.elementMoved.bind(this, i, false)}     
                        >⇩</button>
                        <button
                            className="movebtn"
                            onClick={this.elementMoved.bind(this, i, true)}
                        >⇧</button> */}
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

    protected dragEndHandler() {
        this.draggedId = undefined;
        this.setState({
            index: 0,
            cName: "",
        });
        event?.preventDefault();
    }

    protected dragOverExitHandler(id: number) {
        this.setState({
            index: 0,
            cName: "",
        });
        event?.preventDefault();
    }

    protected dragOverHandler(id: number) {
        if (id == 0 || id == this.draggedId) {
            this.setState({
                index: 0,
                cName: "",
            });
            return;
        }

        if (this.draggedId && id > this.draggedId) {
            this.setState({
                index: id,
                cName: "below-dragged",
            });
        } else if (this.draggedId && id < this.draggedId) {
            this.setState({
                index: id,
                cName: "above-dragged",
            });
        }
        event?.preventDefault();
    }

    //when an element is being dragged over a drop target
    protected dragStartHandler(id: number) {
        console.log("Dragging: " + id);
        if (id != 0) {
            this.draggedId = id;
        }
    }

    //When element is dropped
    protected dropHandler(droppedOnId: number) {
        let elements = this.props.elements;

        /*  We prevent the first item from being dragged because we assume that the checklist
            is only used for the video filters, and we also assume that the first item is the
            "360 to 2D" filter, which should always be the first, therefore it cannot be dragged. */
        if (droppedOnId == 0) {
            console.log("Cannot drag 3d filter");
            return;
        }
        console.log("dragging: " + this.draggedId + " dropping on: " + droppedOnId);
        if (this.draggedId) {
            if (droppedOnId == this.draggedId) {
                this.draggedId = undefined;
                return;
            } else if (droppedOnId > this.draggedId) {
                let dragged = elements[this.draggedId];
                for (let i = this.draggedId; i < droppedOnId; i++) {
                    elements[i] = elements[i + 1];
                }
                elements[droppedOnId] = dragged;
            } else if (droppedOnId < this.draggedId) {
                let dragged = elements[this.draggedId];
                for (let i = this.draggedId; i > droppedOnId; i--) {
                    elements[i] = elements[i - 1];
                }
                elements[droppedOnId] = dragged;
            }
            this.draggedId = undefined;
            this.setState({
                index: 0,
                cName: "",
            });
            this.props.onChanged(elements);
        }
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
        } else if (!movedUp && index < elements.length - 1 && index != 0) {
            elements[index] = elements[index + 1];
            elements[index + 1] = placeholder;
        }
        this.props.onChanged(elements);
    }
}
