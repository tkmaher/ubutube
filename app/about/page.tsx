import type { Metadata } from "next";
import "@/styles/content.scss";
import Link from "next/link";

export const metadata: Metadata = {
    title: "About",
};

export default function Page() {
    return (
        <div className="content-container">
            <div className="viewer-title">
                About
            </div>
            <div className="about">
                <div className="tab0">ubutube.org</div> 
                <div className="tab1">
                    is an extension of the historic avant-garde media archive <a href="https://ubu.com" className="linkout" target="_blank">UbuWeb</a> that supports account creation, bookmarking, and commenting.
                </div>
                <div className="tab1">
                    (ubutube.org is not affiliated with ubu.com in any way.)
                </div>
                <br/>
                <div className="tab1">
                    <Link href="/userlist" className="linkout">
                        Users
                    </Link>
                </div>
                <div className="tab1">
                    <a href="mailto:admin@ubutube.org" target="_blank" className="linkout">
                        Contact us
                    </a>
                </div>
                <div className="tab1">
                    <a href="mailto:bugreport@ubutube.org" target="_blank" className="linkout">
                        Report a bug!
                    </a>
                </div>  
                <br/>
                <div className="tab2">
                    Built by <a href="https://otherseas1.com" className="linkout" target="_blank">otherseas1</a>
                </div>

            </div>
        </div>
    )
}