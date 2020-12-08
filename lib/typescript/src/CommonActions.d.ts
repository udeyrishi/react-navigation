import type * as React from 'react';
import type { NavigationState, PartialState, Route } from './types';
import type { GestureResponderEvent } from 'react-native';
declare type ResetState = PartialState<NavigationState> | NavigationState | (Omit<NavigationState, 'routes'> & {
    routes: Omit<Route<string>, 'key'>[];
});
export declare type Action = {
    type: 'GO_BACK';
    source?: string;
    target?: string;
} | {
    type: 'NAVIGATE';
    payload: {
        key: string;
        name?: undefined;
        params?: object;
        merge?: boolean;
        trigger?: React.MouseEvent<HTMLElement, MouseEvent> | GestureResponderEvent;
    } | {
        name: string;
        key?: string;
        params?: object;
        merge?: boolean;
        trigger?: React.MouseEvent<HTMLElement, MouseEvent> | GestureResponderEvent;
    };
    source?: string;
    target?: string;
} | {
    type: 'RESET';
    payload: ResetState | undefined;
    source?: string;
    target?: string;
} | {
    type: 'SET_PARAMS';
    payload: {
        params?: object;
    };
    source?: string;
    target?: string;
};
export declare function goBack(): Action;
export declare function navigate(route: {
    key: string;
    params?: object;
    trigger?: React.MouseEvent<HTMLElement, MouseEvent> | GestureResponderEvent;
} | {
    name: string;
    key?: string;
    params?: object;
    trigger?: React.MouseEvent<HTMLElement, MouseEvent> | GestureResponderEvent;
}): Action;
export declare function navigate(name: string, params?: object, trigger?: React.MouseEvent<HTMLElement, MouseEvent> | GestureResponderEvent): Action;
export declare function reset(state: ResetState | undefined): Action;
export declare function setParams(params: object): Action;
export {};
