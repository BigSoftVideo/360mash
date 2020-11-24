import { FilterBase } from "../../video/filter-base";

import * as React from "react";

export interface FilterAttributeBinding<FilterT extends FilterBase> {
    setter: (filter: FilterT, value: number) => void;
    getter: (filter: FilterT) => number;
}

export interface FilterAttributesProps<FilterT extends FilterBase> {
    filter: FilterT;
    attributes: Map<string, FilterAttributeBinding<FilterT>>;
}

export class FilterAttributes<FilterT extends FilterBase> extends React.Component<FilterAttributesProps<FilterT>> {
    constructor(params: any) {
        super(params);
    }

    render() {
        let attributes = [...this.props.attributes.entries()].map((v, i) => {
            let [attribName, bindings] = v;
            let value = bindings.getter(this.props.filter);
            let onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                bindings.setter(this.props.filter, event.target.valueAsNumber);
                this.forceUpdate();
            };
            return (
                <div key={i}>
                    <label>
                        {attribName}
                        <input type="number" value={value} onChange={onChange}></input>
                    </label>
                </div>
            );
        });

        return (
            <div>
                {attributes}
            </div>
        );
    }
}
