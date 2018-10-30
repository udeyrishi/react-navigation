import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import invariant from '../utils/invariant';

import NavigationScenesReducer from './ScenesReducer';

// Used for all animations unless overriden
const DefaultTransitionSpec = {
  duration: 250,
  easing: Easing.inOut(Easing.ease),
  timing: Animated.timing,
};

const DEBUG = false;

class Transitioner extends React.Component {
  constructor(props, context) {
    super(props, context);

    // The initial layout isn't measured. Measured layout will be only available
    // when the component is mounted.
    const layout = {
      height: new Animated.Value(0),
      initHeight: 0,
      initWidth: 0,
      isMeasured: false,
      width: new Animated.Value(0),
    };

    const position = new Animated.Value(this.props.navigation.state.index);
    this._positionListener = position.addListener((/* { value } */) => {
      // This should work until we detach position from a view! so we have to be
      // careful to not ever detach it, thus the gymnastics in _getPosition in
      // StackViewLayout
      // This should log each frame when releasing the gesture or when pressing
      // the back button! If not, something has gone wrong with the animated
      // value subscription
      // console.log(value);
    });

    this.state = {
      layout,
      position,
      scenes: NavigationScenesReducer(
        [],
        this.props.navigation.state,
        null,
        this.props.descriptors
      ),
    };

    this._prevTransitionProps = null;
    this._transitionProps = buildTransitionProps(props, this.state);
    this._isMounted = false;
    this._isTransitionRunning = false;
    this._queuedTransition = null;
  }

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
    this._positionListener &&
      this.state.position.removeListener(this._positionListener);
  }

  // eslint-disable-next-line react/no-deprecated
  componentWillReceiveProps(nextProps) {
    let nextScenes = NavigationScenesReducer(
      this.state.scenes,
      nextProps.navigation.state,
      this.props.navigation.state,
      nextProps.descriptors
    );

    // We are adding one or more scene! We can't handle a case where the number
    // of scenes increases and one or more of the new scenes is not in the
    // current navigation state, so we filter anything that's not in the
    // navigation state right now out and assume it has been transitioned out
    // properly beforehand.
    if (nextScenes.length > this.state.scenes.length) {
      nextScenes = filterNotInState(nextScenes, nextProps.navigation.state);
    }

    if (!nextProps.navigation.state.isTransitioning) {
      nextScenes = filterStale(nextScenes);
    }

    // Update nextScenes when we change screenProps
    // This is a workaround for https://github.com/react-navigation/react-navigation/issues/4271
    if (nextProps.screenProps !== this.props.screenProps) {
      this.setState({ nextScenes });
    }

    if (nextScenes === this.state.scenes) {
      return;
    }

    if (__DEV__ && DEBUG) {
      console.log({ nextScenes: nextScenes.map(s => s.descriptor.key) });
    }

    const indexHasChanged =
      nextProps.navigation.state.index !== this.props.navigation.state.index;
    if (this._isTransitionRunning) {
      this._queuedTransition = { nextProps, nextScenes, indexHasChanged };
      return;
    }

    this._startTransition(nextProps, nextScenes, indexHasChanged);
  }

  _startTransition(nextProps, nextScenes, indexHasChanged) {
    const nextState = {
      ...this.state,
      scenes: nextScenes,
    };

    // grab the position animated value
    const { position } = nextState;

    // determine where we are meant to transition to
    const toValue = nextProps.navigation.state.index;

    // compute transitionProps
    this._prevTransitionProps = this._transitionProps;
    this._transitionProps = buildTransitionProps(nextProps, nextState);
    let { isTransitioning } = this._transitionProps.navigation.state;

    // if the state isn't transitioning that is meant to signal that we should
    // transition immediately to the new index. if the index hasn't changed, do
    // the same thing here. it's not clear to me why we ever start a transition
    // when the index hasn't changed, this requires further investigation.
    if (!isTransitioning || !indexHasChanged) {
      this.setState(nextState, async () => {
        if (nextProps.onTransitionStart) {
          const result = nextProps.onTransitionStart(
            this._transitionProps,
            this._prevTransitionProps
          );
          if (result instanceof Promise) {
            // why do we bother awaiting the result here?
            await result;
          }
        }
        // jump immediately to the new value
        indexHasChanged && position.setValue(toValue);
        // end the transition
        this._onTransitionEnd();
      });
    } else if (isTransitioning) {
      this._isTransitionRunning = true;
      this.setState(nextState, async () => {
        if (nextProps.onTransitionStart) {
          const result = nextProps.onTransitionStart(
            this._transitionProps,
            this._prevTransitionProps
          );

          // why do we bother awaiting the result here?
          if (result instanceof Promise) {
            await result;
          }
        }
      });

      // get the transition spec.
      const transitionUserSpec = nextProps.configureTransition
        ? nextProps.configureTransition(
            this._transitionProps,
            this._prevTransitionProps
          )
        : null;

      const transitionSpec = {
        ...DefaultTransitionSpec,
        ...transitionUserSpec,
      };

      const { timing } = transitionSpec;
      delete transitionSpec.timing;

      // if swiped back, indexHasChanged == true && positionHasChanged == false
      const positionHasChanged = position.__getValue() !== toValue;
      if (indexHasChanged && positionHasChanged) {
        timing(position, {
          ...transitionSpec,
          toValue: nextProps.navigation.state.index,
        }).start(this._onTransitionEnd);
      } else {
        this._onTransitionEnd();
      }
    }
  }

  render() {
    if (__DEV__ && DEBUG) {
      let key = this.props.navigation.state.key;
      let routeName = this.props.navigation.state.routeName;
      console.log({
        [key]: this.state.scenes.map(d => d.key),
        route: routeName,
      });
    }

    return (
      <View onLayout={this._onLayout} style={styles.main}>
        {this.props.render(this._transitionProps, this._prevTransitionProps)}
      </View>
    );
  }

  _onLayout = event => {
    const { height, width } = event.nativeEvent.layout;
    if (
      this.state.layout.initWidth === width &&
      this.state.layout.initHeight === height
    ) {
      return;
    }
    const layout = {
      ...this.state.layout,
      initHeight: height,
      initWidth: width,
      isMeasured: true,
    };

    layout.height.setValue(height);
    layout.width.setValue(width);

    const nextState = {
      ...this.state,
      layout,
    };

    this._transitionProps = buildTransitionProps(this.props, nextState);
    this.setState(nextState);
  };

  _onTransitionEnd = () => {
    if (!this._isMounted) {
      return;
    }
    const prevTransitionProps = this._prevTransitionProps;
    this._prevTransitionProps = null;

    const scenes = filterStale(this.state.scenes);

    const nextState = {
      ...this.state,
      scenes,
    };

    this._transitionProps = buildTransitionProps(this.props, nextState);

    this.setState(nextState, async () => {
      if (this.props.onTransitionEnd) {
        const result = this.props.onTransitionEnd(
          this._transitionProps,
          prevTransitionProps
        );

        if (result instanceof Promise) {
          await result;
        }
      }

      if (this._queuedTransition) {
        this._startTransition(
          this._queuedTransition.nextProps,
          this._queuedTransition.nextScenes,
          this._queuedTransition.indexHasChanged
        );
        this._queuedTransition = null;
      } else {
        this._isTransitionRunning = false;
      }
    });
  };
}

function buildTransitionProps(props, state) {
  const { navigation, options } = props;

  const { layout, position, scenes } = state;

  const scene = scenes.find(isSceneActive);

  invariant(scene, 'Could not find active scene');

  return {
    layout,
    navigation,
    position,
    scenes,
    scene,
    options,
    index: scene.index,
  };
}

function isSceneNotStale(scene) {
  return !scene.isStale;
}

function filterStale(scenes) {
  const filtered = scenes.filter(isSceneNotStale);
  if (filtered.length === scenes.length) {
    return scenes;
  }
  return filtered;
}

function filterNotInState(scenes, state) {
  let activeKeys = state.routes.map(r => r.key);
  let filtered = scenes.filter(scene =>
    activeKeys.includes(scene.descriptor.key)
  );

  if (__DEV__ && DEBUG) {
    console.log({
      activeKeys,
      filtered: filtered.map(s => s.descriptor.key),
      scenes: scenes.map(s => s.descriptor.key),
    });
  }

  if (filtered.length === scenes.length) {
    return scenes;
  }
  return filtered;
}

function isSceneActive(scene) {
  return scene.isActive;
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
});

export default Transitioner;