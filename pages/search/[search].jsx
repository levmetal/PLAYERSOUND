

import Loader from '../../components/loader'
import Layout from '../../components/layout'
import { memo ,Suspense} from 'react'
import dynamic from 'next/dynamic'
import styles from '../../styles/search.module.css'
const SoundList = dynamic(() => import('../../components/soundList'), {
  suspense: true,
})

const Search = memo(({ data }) => {

  let dataSearch = [data]

  return (
    <>

      <div className={styles.container}>


        <Layout>
          <Suspense fallback={<Loader/>}>

          <SoundList dataSearch={dataSearch} />
          </Suspense>
      
        </Layout>

      </div>


    </>


  )
})

export default Search

export async function getServerSideProps(context) {

  const { query } = context
  const { search } = query
  try {
    const response = await fetch(`http://localhost:3000/api/search/${search}`)
    const data = await response.json()

    return {
      props: { data }

    }

  } catch (error) {
    console.log(error);
  }

}