/**
 * TouchableItem provides an abstraction on top of TouchableNativeFeedback and
 * TouchableOpacity to handle platform differences.
 *
 * On Android, you can pass the props of TouchableNativeFeedback.
 * On other platforms, you can pass the props of TouchableOpacity.
 */
import * as React from 'react';
import { ViewProps, GestureResponderEvent } from 'react-native';
export declare type Props = ViewProps & {
    pressColor?: string;
    disabled?: boolean | null;
    borderless?: boolean;
    delayPressIn?: number;
    onPress?: (event: React.MouseEvent<HTMLElement, MouseEvent> | GestureResponderEvent) => void;
    children: React.ReactNode;
};
export default function TouchableItem({ borderless, pressColor, style, children, ...rest }: Props): JSX.Element;
