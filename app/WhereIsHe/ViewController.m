//
//  ViewController.m
//  WhereIsHe
//
//  Created by tomaszbrue on 14.08.13.
//  Copyright (c) 2013 InformMe. All rights reserved.
//

#import "ViewController.h"
#import "AppDelegate.h"
#import <math.h>

@interface ViewController ()

@end

@implementation ViewController

@synthesize waitingCount, onOff, timer, bytesSent, bytesSentRevert, labelSentMsg, labelSentButton;

- (void)viewDidLoad
{
    [super viewDidLoad];
    
    [self.onOff addTarget:self action:@selector(setState:) forControlEvents:UIControlEventValueChanged];
    [self.bytesSentRevert addTarget:self action:@selector(revertBytesSent:) forControlEvents:UIControlEventTouchUpInside];
    [self.labelSentButton addTarget:self action:@selector(sentLabel:) forControlEvents:UIControlEventTouchUpInside];
    [self startUpdating];
    
    [self.labelSentMsg setDelegate:self];
}

- (void)startUpdating
{
    timer = [NSTimer scheduledTimerWithTimeInterval: 1
                                             target: self
                                           selector:@selector(loadValues:)
                                           userInfo: nil
                                            repeats: YES];
}

- (void)stopUpdating
{
    [timer invalidate];
}

-(void)loadValues:(NSTimer *)theTimer
{
    // WAITING COUNT
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
    NSArray *dataCache = [prefs arrayForKey:@"data.cache"];
    self.waitingCount.text = [NSString stringWithFormat:@"%i", (int)[dataCache count]];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

- (void)setState:(id)sender
{
    BOOL state = [sender isOn];
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
    [prefs setBool:state forKey:@"service.state"];
    
    AppDelegate *appDelegate = (AppDelegate *)[[UIApplication sharedApplication] delegate];
    
    if (state == NO) {
        [appDelegate.locationManager stopUpdatingLocation];
    }
    else {
        [appDelegate.locationManager startUpdatingLocation];
    }
}

- (void)revertBytesSent:(id)sender
{
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
    [prefs setObject:[NSNumber numberWithInt:0] forKey:@"bytes.sent"];
    [self.bytesSent setText:@"0"];
}

- (void)sentLabel:(id)sender
{
    AppDelegate *appDelegate = (AppDelegate *)[[UIApplication sharedApplication] delegate];
    CLLocation *loc = [appDelegate getLastLocation];
    NSString *title = self.labelSentMsg.text;
    
    if ([title length] <= 1) {
        return;
    }
    
    NSString *post = [NSString stringWithFormat:@"boat=3&title=%@&latitude=%f&longitude=%f", title, loc.coordinate.latitude, loc.coordinate.longitude];
    NSData *postData = [post dataUsingEncoding:NSASCIIStringEncoding allowLossyConversion:YES];
    
    NSString *postLength = [NSString stringWithFormat:@"%d", [postData length]];
    
    NSMutableURLRequest *request = [[NSMutableURLRequest alloc] init];
    [request setURL:[NSURL URLWithString:@"https://tracktrack.io/api/label/add"]];
    [request setHTTPMethod:@"POST"];
    [request setValue:postLength forHTTPHeaderField:@"Content-Length"];
    [request setValue:@"application/x-www-form-urlencoded" forHTTPHeaderField:@"Content-Type"];
    [request setHTTPBody:postData];
    
    NSURLConnection *conn = [[NSURLConnection alloc] initWithRequest:request delegate:self];
    [self.labelSentMsg setText:@""];
    [labelSentMsg resignFirstResponder];
}

-(BOOL)textFieldShouldReturn:(UITextField *)textField
{
    [labelSentMsg resignFirstResponder];
    return YES;
}


@end
