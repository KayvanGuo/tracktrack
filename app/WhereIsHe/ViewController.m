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

@synthesize waitingCount, onOff, timer, bytesSent, bytesSentRevert;

- (void)viewDidLoad
{
    [super viewDidLoad];
    
    [self.onOff addTarget:self action:@selector(setState:) forControlEvents:UIControlEventValueChanged];
    [self.bytesSentRevert addTarget:self action:@selector(revertBytesSent:) forControlEvents:UIControlEventTouchUpInside];
    [self startUpdating];
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
    // WaITING COUNT
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
    NSArray *dataCache = [prefs arrayForKey:@"data.cache"];
    self.waitingCount.text = [NSString stringWithFormat:@"%i", [dataCache count]];
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


@end
