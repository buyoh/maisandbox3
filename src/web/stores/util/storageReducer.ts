const K_A_Set_prefix = 'common/storage_reducer/set/';

interface State<T> {
  value: T;
}

interface Action<T> {
  type: string;
  value: T;
}

// 以下の機能を持つ、型汎用的なReducerとActionを作る。
// 識別子となる適当な文字列と初期値が必要。
// * 値をセットする
export function createStorageReducer<T>(
  identifier: string,
  initialValue: T
): {
  reducer: (state: State<T> | undefined, action: Action<T>) => State<T>;
  method: {
    setStorage: (value: T) => Action<T>;
  };
} {
  const actionKey = K_A_Set_prefix + identifier;
  const initialState = { value: initialValue };

  const reducer = (state = initialState, action: Action<T>): State<T> => {
    if (action.type === actionKey) {
      return {
        value: action.value,
      };
    }
    return state;
  };

  const setStorage = (value: T): Action<T> => {
    return { type: actionKey, value };
  };

  return {
    reducer,
    method: {
      setStorage,
    },
  };
}
