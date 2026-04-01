declare module 'react-native-keyboard-aware-scroll-view' {
  import { Component } from 'react';
  import { ScrollViewProps } from 'react-native';

  export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
    enableOnAndroid?: boolean;
    enableAutomaticScroll?: boolean;
    extraScrollHeight?: number;
    keyboardOpeningTime?: number;
    viewIsInsideTabBar?: boolean;
    enableResetScrollToCoords?: boolean;
    resetScrollToCoords?: { x: number; y: number } | null;
  }

  export class KeyboardAwareScrollView extends Component<KeyboardAwareScrollViewProps> {}

  export default KeyboardAwareScrollView;
}


