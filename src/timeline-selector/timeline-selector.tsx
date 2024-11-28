import React, { useRef, useState, useEffect, RefObject, MutableRefObject, ForwardedRef, Ref } from 'react';
import { Button, Dialog, majorScale, minorScale, Pane, Text, TextInput } from "evergreen-ui";
import { getTrackBackground, Range } from 'react-range';
import { useThumbOverlap } from 'react-range';

// const COLORS = ["#0C2960", "#276EF1", "#9CBCF8", "#ccc"];
const COLORS = ["#ccc", "#ccc", "#ccc", "#ccc"];
const THUMB_SIZE = 20;

interface Props {
    videoLength: number;
    currentTime: number;
    selectionStart: number;
    selectionEnd: number;
    setTime: (newTime:number) => void;
    setSelection: (start:number, end:number) => void;
}

export interface TimelineSelectorMethods {

}

export const TimelineSelector = React.forwardRef<TimelineSelectorMethods, Props>( (props:Props, ref) => {
    const { videoLength, currentTime, selectionStart, selectionEnd, setTime, setSelection } = props;

    const rangeRef = useRef<Range>(null);
    const [start, setStart] = useState<number>(0);

    React.useImperativeHandle(ref, () => ({

    }));

    const MAX = videoLength || 1;

    // Within-Range
    function wR(value:number):number {
        return Math.max(0, Math.min(MAX, value));
    }

    return (
        <Pane margin={minorScale(1)} paddingTop={24} paddingX={30} border="inset" width="100%" backgroundColor="#AAAAAA33">
            <Range
                ref={rangeRef}
                values={[wR(currentTime), wR(selectionStart), wR(selectionEnd)]}
                onChange={ (values) => {
                    let [newCurrentTime, newSelectionStart, newSelectionEnd] = values;
                    if (currentTime !== newCurrentTime) {
                        setTime(newCurrentTime);
                    }
                    if (selectionStart !== newSelectionStart) {
                        newSelectionEnd = Math.max(newSelectionStart, newSelectionEnd);
                        newSelectionStart = Math.min(newSelectionStart, newSelectionEnd);
                        setSelection(newSelectionStart, newSelectionEnd);
                    } else
                    if (selectionEnd !== newSelectionEnd) {
                        newSelectionStart = Math.min(newSelectionStart, newSelectionEnd);
                        newSelectionEnd = Math.max(newSelectionStart, newSelectionEnd);
                        setSelection(newSelectionStart, newSelectionEnd);
                    }
                }}
                allowOverlap
                min={0}
                max={MAX}
                step={0.03}
                renderTrack={({ props, children }) => (
                    <div
                    onMouseDown={props.onMouseDown}
                    onTouchStart={props.onTouchStart}
                    style={{
                        ...props.style,
                        height: "36px",
                        display: "flex",
                        width: "100%",
                    }}
                    >
                    <div
                        ref={props.ref}
                        style={{
                        height: "5px",
                        width: "100%",
                        borderRadius: "4px",
                        background: getTrackBackground({
                            values: [currentTime, selectionStart, selectionEnd],
                            colors: COLORS,
                            min: 0,
                            max: videoLength || 1,
                            // rtl,
                        }),
                        alignSelf: "center",
                        }}
                    >
                        {children}
                    </div>
                    </div>
                )}
                renderThumb={({ props, index, isDragged }) => {
                    // Index 0 should be 'currentTime' slider
                    return (
                    <div
                        {...props}
                        key={props.key}
                        style={{
                            ...props.style,
                            height: index === 0 ? `${THUMB_SIZE}px` : `${THUMB_SIZE / 1.3}px`,
                            width: index === 0 ? `${THUMB_SIZE}px` : `${THUMB_SIZE / 2}px`,
                            borderRadius: "4px",
                            backgroundColor: index === 0 ? "#FFF" : "#999",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            boxShadow: "0px 2px 6px #AAA",
                            zIndex: index === 0 ? 3 : 1
                        }}
                    >
                        <ThumbLabel
                            rangeRef={rangeRef.current}
                            values={[currentTime, selectionStart, selectionEnd]}
                            index={index}
                        />
                        <div
                        style={{
                            height: "16px",
                            width: "5px",
                            backgroundColor: isDragged ? "#548BF4" : "#CCC",
                        }}
                        />
                    </div>
                    );
                }}
            />
        </Pane>
    )
});

const ThumbLabel = ({
    rangeRef,
    values,
    index,
}: {
    rangeRef: Range | null;
    values: number[];
    index: number;
}) => {
    // if (values.length !== 3) {
    //     return <></>;
    // }
    const [labelValue, style] = useThumbOverlap(rangeRef, values, index);
    return (
    <div
        data-label={index}
        style={{
        display: "block",
        position: "absolute",
        top: "-28px",
        color: "#fff",
        fontWeight: "bold",
        fontSize: "14px",
        fontFamily: "Arial,Helvetica Neue,Helvetica,sans-serif",
        padding: "4px",
        borderRadius: "4px",
        backgroundColor: "#548BF4",
        whiteSpace: "nowrap",
        ...(style as React.CSSProperties),
        }}
    >
        {labelValue as string}
    </div>
    );
};