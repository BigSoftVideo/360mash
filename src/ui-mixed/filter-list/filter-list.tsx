import * as React from "react";
import { FilterPipeline } from "../../video/filter-pipeline";
import { ChecklistElement } from "../../ui-presentational/checklist/checklist";
import { Checklist } from "../../ui-presentational/checklist/checklist";
import { FilterId } from "../../video/filter-base";
import { GRAYSCALE_FILTER_NAME } from "../../filters/grayscale";

interface FilterDesc {
    id: string;
    inUse: boolean;
    selected: boolean;
}

interface FilterListState {
    filters: FilterDesc[];
}

export interface FilterListProps {
    pipeline: FilterPipeline;
    selectionChanged: (selectedId: string | null) => void;
}

export class FilterList extends React.Component<FilterListProps, FilterListState> {
    onChanged: (elements: ChecklistElement[]) => void;

    constructor(params: any) {
        super(params);

        let thisFilters: FilterDesc[] = [];
        let filterDescs = this.props.pipeline.getFilters();
        for (const desc of filterDescs) {
            thisFilters.push({
                id: desc.id,
                inUse: true,
                selected: false,
            });
        }
        this.state = {
            filters: thisFilters,
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
        let checklistElements = this.state.filters.map((f) => {
            return {
                name: f.id,
                checked: f.inUse,
                selected: f.selected,
            };
        });
        return (
            <Checklist
                elements={checklistElements}
                onChanged={this.onChanged}
                selectable={true}
            ></Checklist>
        );
    }
}
