
import SideBar from '../components/sideBar'


export default function Layout({ children }) {
    return (
      <>

      
        <SideBar/>
        {children}
        
      
      </>
    )
  }