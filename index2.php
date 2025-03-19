<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 Page Not Found</title>
    <style>
        /*======================
            404 page
        =======================*/

        .page_404 {
            padding: 40px 0;
            background: #fff;
            font-family: 'Arvo', serif;
        }

        .page_404 img {
            width: 100%;
        }

        .four_zero_four_bg {
            background-image: url(https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif);
            height: 1000px;
            background-position: center;
            background-repeat: no-repeat;
            text-align: center;
        }

        .four_zero_four_bg h1 {
            font-size: 80px;
            color: #fff;
        }

        .four_zero_four_bg h3 {
            font-size: 30px;
            color: #fff;
        }

        .link_404 {
            color: #fff !important;
            padding: 10px 20px;
            background: #39ac31;
            margin: 20px 0;
            display: inline-block;
            text-decoration: none;
        }

        .contant_box_404 {
            margin-top: -50px;
            text-align: center;
        }

        .contant_box_404 h3 {
            font-size: 24px;
        }

        .contant_box_404 p {
            font-size: 18px;
            color: #555;
        }

        @media (max-width: 767px) {
            .four_zero_four_bg {
                height: 400px;
            }

            .four_zero_four_bg h1 {
                font-size: 60px;
            }

            .four_zero_four_bg h3 {
                font-size: 24px;
            }

            .contant_box_404 h3 {
                font-size: 20px;
            }

            .contant_box_404 p {
                font-size: 16px;
            }
        }
    </style>
</head>

<body>
    <section class="page_404">
        <div class="container">
            <div class="row">
                <div class="col-sm-12">
                    <div class="col-sm-10 col-sm-offset-1 text-center">
                        <div class="four_zero_four_bg">
                            <h1 class="text-center">404</h1>
                        </div>

                        <div class="contant_box_404">
                            <h3 class="h2">
                                Looks like you're lost
                            </h3>

                            <p>The page you are looking for is not available!</p>

                            <!-- <a href="/" class="link_404">Go to Home</a> -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</body>

</html>

<!-- <!DOCTYPE html>
<html>
<head> 
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <meta charset="utf-8">
   <meta http-equiv="X-UA-Compatible" content="IE=edge">
   <title>The Signature</title>
   <link rel="stylesheet" href="../libs/css/bootstrap.v3.3.6.css">
   <script type="text/javascript" src="assets/signature.js"></script>
   <style>
     body{
     padding: 15px;
     }
     #note{position:absolute;left:50px;top:35px;padding:0px;margin:0px;cursor:default;}
</style>
</head>
<body>
<h1>Digital Signature</h1>
<form method="post" action="process.php" enctype="multipart/form-data">
   <div id="signature-pad">
     <div style="border:solid 1px teal; width:360px;height:110px;padding:3px;position:relative;">
        <div id="note" onmouseover="my_function();">The signature should be inside box</div>
        <canvas id="the_canvas" width="350px" height="100px"></canvas>
     </div>
     <div style="margin:10px;">
        <input type="hidden" id="signature" name="signature">
        <button type="button" id="clear_btn" class="btn btn-danger" data-action="clear"><span class="glyphicon glyphicon-remove"></span> Clear</button>
        <button type="submit" id="save_btn" class="btn btn-primary" data-action="save-png"><span class="glyphicon glyphicon-ok"></span> Save as PNG</button>
     </div>
   </div>
<form>
   
<script>
var wrapper = document.getElementById("signature-pad");
var clearButton = wrapper.querySelector("[data-action=clear]");
var savePNGButton = wrapper.querySelector("[data-action=save-png]");
var canvas = wrapper.querySelector("canvas");
var el_note = document.getElementById("note");
var signaturePad;
signaturePad = new SignaturePad(canvas);
clearButton.addEventListener("click", function (event) {
   document.getElementById("note").innerHTML="The signature should be inside box";
   signaturePad.clear();
});
savePNGButton.addEventListener("click", function (event){
   if (signaturePad.isEmpty()){
     alert("Please provide signature first.");
     event.preventDefault();
   }else{
     var canvas  = document.getElementById("the_canvas");
     var dataUrl = canvas.toDataURL();
     document.getElementById("signature").value = dataUrl;
   }
});
function my_function(){
   document.getElementById("note").innerHTML="";
}
</script> -->
<!-- </body>
</html> -->
