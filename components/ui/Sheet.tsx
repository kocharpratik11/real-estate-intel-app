import { useCallback, useEffect, useMemo, useRef, type ElementRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { runOnUI } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

// TEMP diagnostic — proves whether Babel is actually workletizing functions,
// independent of @gorhom/bottom-sheet's own internals. If "[worklet] ran on UI
// thread" never prints, or this throws, worklets aren't being processed and
// that's the root cause, not anything specific to the bottom-sheet library.
function testWorklet() {
  try {
    runOnUI(() => {
      'worklet';
      console.log('[worklet] ran on UI thread');
    })();
    console.log('[worklet] runOnUI() called without throwing on JS thread');
  } catch (e) {
    console.log('[worklet] runOnUI() threw on JS thread:', e);
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
};

/**
 * Shared bottom-sheet shell for all "add/record/edit" sheets in the app.
 * Wraps @gorhom/bottom-sheet so every sheet gets real swipe-down-to-dismiss
 * (previously every sheet was a plain RN Modal with a decorative-only handle
 * bar — it looked draggable but nothing happened if you actually swiped it).
 * Keeps the same visible/onClose prop shape the old Modal-based sheets used,
 * so callers don't need to change.
 */
export function Sheet({ visible, onClose, children, snapPoints: snapPointsProp }: Props) {
  const ref = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const snapPoints = useMemo(() => snapPointsProp ?? ['90%'], [snapPointsProp]);

  useEffect(() => {
    if (visible) {
      testWorklet();
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enablePanDownToClose
      onChange={(index) => console.log('[Sheet] onChange index=', index)}
      onAnimate={(from, to) => console.log('[Sheet] onAnimate from=', from, 'to=', to)}
    >
      {children}
    </BottomSheetModal>
  );
}

export { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: Colors.border,
    width: 40,
  },
});
