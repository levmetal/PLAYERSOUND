import { createContext, useContext, useReducer } from "react";
import soundReducer from "./libraryReducer";
import  object from '../../objectLibrary/initialLibrary.json'

export const SoundContext = createContext(null)
export const SoundDispatchContext = createContext(null)


export function useSoundContext() {
    return useContext(SoundContext)
}
export function useDispatchContext() {
    return useContext(SoundDispatchContext)
}



export function SoundProvider({ children }) {

    const [state, dispatch] = useReducer(
        soundReducer,
        object
    )


    return (
        <SoundContext.Provider value={state}>
            <SoundDispatchContext.Provider value={dispatch}>
                {children}
            </SoundDispatchContext.Provider>
        </SoundContext.Provider>
    )



}