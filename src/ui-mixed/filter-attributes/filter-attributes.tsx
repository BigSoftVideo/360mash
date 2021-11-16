import { FilterBase } from "../../video/filter-base";
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import * as React from "react";
import { NumberInput } from "../../ui-presentational/number-input/number-input";
import { Grid } from "@mui/material";
import "./filter-attributes.css";

export enum FilterAttributeKind {
    Number,
    Option,
    Bool
}

export interface FilterAttributeBinding<FilterT extends FilterBase> {
    setter: (filter: FilterT, value: number) => void;
    getter: (filter: FilterT) => number;

    kind: FilterAttributeKind;

    minValue?: number;
    maxValue?: number;

    /**
     * An array of (number, string) pairs where the number is the value of the option
     * and the string is the name that's displayed for the value
     */
    optionValues?: [number, string][];
}

export interface FilterAttributesProps<FilterT extends FilterBase> {
    filter: FilterT;
    attributes: Map<string, FilterAttributeBinding<FilterT>>;
}


export class FilterAttributes<FilterT extends FilterBase> extends React.Component<
    FilterAttributesProps<FilterT>
> {
    constructor(params: any) {
        super(params);
    }

    render() {
        let attributes = [...this.props.attributes.entries()].map((v, i) => {
            let [attribName, bindings] = v;
            let currValue = bindings.getter(this.props.filter);
            let onChange = (value: number) => {
                bindings.setter(this.props.filter, value);
                this.forceUpdate();
            };
            let input;
            if (bindings.kind === FilterAttributeKind.Option) {
                if (bindings.optionValues === undefined) {
                    console.error(
                        "The option values must be defined when the attribute is of type option."
                    );
                } else {
                    let options = bindings.optionValues.map(([value, name], i) => {
                        return (
                            <option key={i} value={value}>
                                {name}
                            </option>
                        );
                    });
                    input = (
                        <select
                            className="filter-attributes"
                            value={currValue}
                            onChange={(event) => onChange(Number.parseInt(event.target.value))}
                        >
                            {options}
                        </select>
                    );
                }
            } else if (bindings.kind === FilterAttributeKind.Number) {
                input = (
                    <Grid container spacing={2} paddingLeft={1.5}>
                        <Grid item>
                            <Slider
                            sx={{width: 200}}
                            onChange={(event, val) => onChange(val) }
                            value={typeof currValue === 'number' ? currValue : 0}
                            valueLabelDisplay="off"
                            min={bindings.minValue}
                            max={bindings.maxValue}
                            step={0.0001}
                            />
                        </Grid>
                        <Grid item>
                            <NumberInput
                                onChanged={(val) => onChange(val)}
                                value={currValue}
                                minValue={bindings.minValue}
                                maxValue={bindings.maxValue}
                            />
                        </Grid>
                    </Grid>
                );
            } else if (bindings.kind === FilterAttributeKind.Bool) {
                input = (
                    <Checkbox
                    color={"default"}
                    checked={currValue != 0}
                    onChange={(event, val) => onChange(val ? 1 : 0)}
                    />
                );
            }// else if (bindings.kind === FilterAttributeKind.Number || bindings.maxValue == undefined || bindings.minValue == undefined) {
            //     input = (
            //         <NumberInput
            //             onChanged={(val) => onChange(val)}
            //             value={currValue}
            //             minValue={bindings.minValue}
            //             maxValue={bindings.maxValue}
            //         ></NumberInput>
            //     );
            // }
            return (
                <div key={i}>
                    <label className="filter-attributes">
                        {attribName}
                        {input}
                    </label>
                </div>
            );
        });

        return <div>{attributes}</div>;
    }
}
