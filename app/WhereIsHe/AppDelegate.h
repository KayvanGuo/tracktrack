//
//  AppDelegate.h
//  WhereIsHe
//
//  Created by tomaszbrue on 14.08.13.
//  Copyright (c) 2013 InformMe. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <CoreLocation/CoreLocation.h>
#import "GCDAsyncSocket.h"

@interface AppDelegate : UIResponder <UIApplicationDelegate, CLLocationManagerDelegate>
{
    CLLocation *location;
    UIBackgroundTaskIdentifier bgTask;
}

@property (strong, nonatomic) UIWindow *window;
@property (nonatomic, retain) NSDate *lastUpdate;
@property (atomic) BOOL reachable;
@property (nonatomic, retain) CLLocationManager *locationManager;

-(void)locationManager:(CLLocationManager *)manager
   didUpdateToLocation:(CLLocation *)newLocation
          fromLocation:(CLLocation *)oldLocation;
-(void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error;
 -(void)flushDataCache:(NSTimer *)theTimer;

@end
