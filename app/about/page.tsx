import type { Metadata } from "next";
import "@/styles/content.scss";

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
                <div className="tab0">ubutube.org is an archive of an archive. </div>
                <div className="tab1">
                    It is a wrapper of the film section of the historic avant-garde media archive <a href="https://ubu.com" className="linkout" target="_blank">UbuWeb</a>.
                </div>
                <div className="tab1">
                    (ubutube.org is not affiliated with ubu.com in any way, but was created with the utmost gratitude for the important work of the latter.)
                </div>
                <div className="tab2">
                    UbuTube currently supports account creation, film bookmarking, and commenting. Please keep your activities respectful and intentional.
                </div>
                <br/>
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