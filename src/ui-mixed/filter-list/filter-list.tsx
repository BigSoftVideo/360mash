import * as React from "react";
import { FilterPipeline } from "../../video/filter-pipeline";
import { ChecklistElement } from "../../ui-presentational/checklist/checklist";
import { Checklist } from "../../ui-presentational/checklist/checklist";
import { FilterId } from "../../video/filter-base";
import { GRAYSCALE_FILTER_NAME } from "../../filters/grayscale";

interface FilterDesc {
    id: string;
    inUse: boolean;
}

interface FilterListState {
    filters: FilterDesc[] | null;
}

export interface FilterListProps {
    pipeline: FilterPipeline;
    selectedId: string | null;
    selectionChanged: (selectedId: string | null) => void;
}

export class FilterList extends React.Component<FilterListProps, FilterListState> {
    onChanged: (elements: ChecklistElement[]) => void;

    constructor(params: any) {
        super(params);

        this.state = {
            filters: null,
        };
        this.onChanged = (elements) => {
            let oldFilters = this.props.pipeline.getFilters();
            let oldIndicies = new Map<FilterId, number>();
            let i = 0;
            for (const desc of oldFilters) {
                oldIndicies.set(desc.id, i);
                i++;
            }
            let newOrder = elements.map((e) => oldIndicies.get(e.name)!);
            this.props.pipeline.setOrder(newOrder);

            let active = elements.map((e) => e.checked);
            this.props.pipeline.setActive(active);

            let selected: string | null = null;
            let filters = elements.map((e) => {
                if (e.selected) {
                    selected = e.name;
                }
                return {
                    id: e.name,
                    inUse: e.checked,
                    selected: e.selected,
                };
            });
            this.props.selectionChanged(selected);
            this.setState({
                filters: filters,
            });
        };
    }

    render() {
        let checklistElements: ChecklistElement[] = [];
        if (this.state.filters) {
            checklistElements = this.state.filters.map((f) => {
                return {
                    name: f.id,
                    checked: f.inUse,
                    selected: f.id === this.props.selectedId,
                };
            });
        }
        return (
            <Checklist
                elements={checklistElements}
                onChanged={this.onChanged}
                selectable={true}
            ></Checklist>
        );
    }

    componentDidMount() {
        let thisFilters: FilterDesc[] = [];
        let filterDescs = this.props.pipeline.getFilters();
        for (const desc of filterDescs) {
            thisFilters.push({
                id: desc.id,
                inUse: true,
            });
        }
        this.setState({filters: thisFilters});
    }
}
