import Search from "./search";
import Tools from "./tools";

export default function Columns({children}: {children: React.ReactNode}) {
    return (
        <div className="appcontainer">
            <Tools/>
            <div className="main">{children}</div>
            <Search/>
        </div>
    );
}