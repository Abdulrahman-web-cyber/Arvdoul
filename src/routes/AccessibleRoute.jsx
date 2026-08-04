export default function AccessibleRoute({ children }) { return <main role="main" tabIndex={-1}>{children}</main>; }
