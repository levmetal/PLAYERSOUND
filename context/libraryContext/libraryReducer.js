




export default function soundReducer(state, action) {


    switch (action.type) {
        case 'addLibrary': {
            
            return [...state, {
                id: action.payload.id,
                title: action.payload.title,
                link: action.payload.link,
                thumbnail: action.payload.thumbnail,
                channel:action.payload.channel
            }]

        }
        
        case 'delLibrary':{
          return  state.filter(itemlibrary=>  itemlibrary.id !==action.payload)
        }  


        case 'alert':{
            action.payload
        }

        default:

            return state
    }

}