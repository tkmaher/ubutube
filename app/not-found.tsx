import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div>
      <div>Page not found!</div>
      <Link className='linkout ubu-linkout' href="/">Return Home</Link>
    </div>
  )
}